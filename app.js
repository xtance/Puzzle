const fs = require('fs');
const http = require('http');
const express = require('express');
const path = require('path');

let images = [];
fs.readdirSync('./public/images/').forEach(file => images.push('./images/' + file));
images.forEach(image => console.log(image + ','));
console.log('\n^ Скопируйте список картинок в /public/training.js \n');

const app = express();

// Удаление .html из адреса странички
app.use(function(req, res, next) {
	if (req.path.endsWith('.html')) res.redirect(301, req.path.replace('.html', ''));
    else next();
});

// Разрешаем использовать все файлы из папки public
app.use(express.static(__dirname + path.sep + 'public', { dotfiles: 'allow', extensions: ['html', 'htm'] } ));

// Создание сервера
const httpServer = http.createServer(app);
httpServer.listen(8080, () => {
	console.log('HTTP Server running on port 80');
});

const io = require('socket.io')(httpServer);

// Рекорды
let records = {};
fs.readFile('records.json', 'utf8', function (err, data) {
	if (err) console.log('Ошибка чтения рекордов',err);
	records = JSON.parse(data);
});

// Подключение нового игрока
io.on('connection', (socket) => {

	// Статус игрока (0: выбирает сложность, 1: в поиске, 2: в игре)
	socket._status = 0;
	console.log('Новое подключение с IP: ' + socket.conn.remoteAddress);
	
	// Событие поиска
	socket.on('search', (obj) => {

		// Если игрок каким-то образом запустил поиск, уже находясь в поиске или в игре
		if (socket._status !== 0)  return Notify(socket.id, 'Ошибка', 'Поиск невозможен - обновите страницу!', 'red');

		socket._diff 	= obj.diff ? parseInt(obj.diff) : 7;
		socket._name 	= obj.name ? Escape(obj.name) : 'Аноним';
		socket._scores 	= 0;
		socket._index	= -1;
		
		if (socket._diff < 2 || socket._diff > 10) socket._diff = 7;
		if (socket._name === "") socket._name = 'Аноним';

		for (const [key, s] of Object.entries(io.sockets.sockets)) {
			if (s._status === 1 && s._diff === socket._diff){

				// Если нашёлся игрок с статусом 1 и такой же выбранной сложностью, создаётся новая игра
				Match(
					images[Math.floor(Math.random() * images.length)], 	// Адрес случайной картинки
					socket._diff,										// Сложность
					[s, socket]											// Массив из этих двух игроков
				);

				return;
			}
		}

		// Если никто не нашелся в прошлом цикле, игрок получает статус 1 и уведомление о поиске через каждые 5 сек.
		socket._status	= 1;
		Notify(socket.id, 'Поиск игроков', 'Онлайн: ' + (Object.keys(io.sockets.sockets).length - 1), '', 'dark');
		socket._search = setInterval(() => Notify(socket.id, 'Поиск игроков', 'Онлайн: ' + (Object.keys(io.sockets.sockets).length - 1), '', 'dark'), 5000);
	});

	// Игрок отключился
	socket.on('disconnect', () => {
		// Удаление таймера
		if (socket._search) clearInterval(socket._search);
	});

	// Игрок запросил рекорды
	socket.on('records', () => {
		socket.emit('records', records);
	});
});

const Match = (url, diff, sockets) => {

	// Время в мс, когда началась игра
	const ts = + new Date();

	// Массив из случайных чисел
	const r = Shuffle(Array.from(Array(diff*diff).keys()));
	let tiles = [];
	for (let i = 0; i < diff*diff; i++) tiles.push({init: i, now: r[i], taken: false});

	// Проверяет, существует ли такой индекс
	const IsValidIndex = (index) => ((0 <= index) && (index < diff*diff)); 

	// Счётчик очков, игра закончится когда он больше или равен diff*diff
	// Если какие-то плитки изначально стоят правильно, это будет здесь учитываться
	let counter = 0;
	tiles.forEach(tile => {
		if (tile.now === tile.init) counter++;
	});
	
	// Создаём события для всех (двух) сокетов, участвующих в игре
	sockets.forEach((socket, index) => {

		// Начало матча: отсылаем информацию об игре
		io.to(socket.id).emit('start', {url: url, diff: diff, info: Info(sockets), r: r});
		socket._status = 2;
		if (socket._search) clearInterval(socket._search);

		// Игрок взял плитку мышкой
		socket.on('dragstart', (index) => {

			// Этого не должно происходить - игрок не может поднять плитку, не опустив предыдущую
			if (socket._index !== -1) sockets.forEach(s => io.to(s.id).emit('toggle_index', {index: socket._index, drag: (tiles[socket._index].now !== tiles[socket._index].init)}));

			// На всякий случай
			index = parseInt(index);

			// Если пришёл нереальный индекс плитки
			if (!IsValidIndex(index)) return Notify(socket.id, 'Ошибка', 'Неправильный индекс.', 'red');

			// Ищем плитку
			let tile1 = GetTileAtIndex(index);
			if (!tile1) return Notify(socket.id, 'Ошибка', 'Не найдена плитка по индексу ' + index, 'red');

			// Указывает на то, что данному игроку пока что не принадлежит плитка
			socket._index = -1;
			
			// Если плитку уже кто-то взял - вообще, это тоже не должно происходить, так как блокируется поднятие плитки
			if (tile1.taken) return Notify(socket.id, 'Ошибка', 'Плитка используется другим игроком, выберите другую.', 'red');

			// Если плитка уже стоит на правильном месте
			if (tile1.now === tile1.init) return Notify(socket.id, 'Ошибка', 'Плитка уже установлена правильно', 'blue');

			// Переключаем передвигабельность плитки на всех игроках
			socket._index = tile1.now;
			tile1.taken = true;
			sockets.forEach(s => io.to(s.id).emit('toggle_index', {index: tile1.now, drag: s.id === socket.id}));
		});

		// Игрок отпустил плитку на каком-то индексе
		socket.on('dragend', (destination) => {
			
			destination = parseInt(destination);
			let tile1 = GetTileAtIndex(socket._index);
			let tile2 = GetTileAtIndex(destination);

			if (!tile1) return console.log('Ошибка - тайл ('+socket._index+') не существует.');

			if (Switch(socket, tile1, tile2)){
				// Меняем местами номера плиток.
				tile1.now = tile2.now;
				tile2.now = socket._index;
				
				// Визуально отображаем это на экране у всех игроков
				sockets.forEach(s => io.to(s.id).emit('switch', tile1.now, tile2.now, s.id === socket.id));

				// Подсчёт очков
				const scores = socket._scores;
				if (tile1.now === tile1.init) {
					socket._scores += 1;
					counter += 1;
				}
				if (tile2.now === tile2.init) {
					socket._scores += 1;
					counter += 1;
				}
				if (socket._scores > scores) sockets.forEach(s => io.to(s.id).emit('scores', Info(sockets)));

			} else {
				// Двигание плитки не удалось - возвращаем её обратно, туда, откуда взяли
				io.to(socket.id).emit('switch', tile1.now, tile1.now);
			}

			// В любом случае, "освобождаем" плитку, которую держал игрок
			tile1.taken = false;
			sockets.forEach(s => io.to(s.id).emit('toggle_index', {index: tile1.now, drag: (tile1.now !== tile1.init)}));
			socket._index = -1;

			// Проверка на победу
			if (counter >= diff*diff){

				const unixtime = parseInt((+ new Date() - ts)/1000);
				const min = Math.floor((unixtime/60/60)*60);
				const sec = Math.floor(((unixtime/60/60)*60 - min)*60);
				const time = ('0'+min).slice(-2) + ':' + ('0'+sec).slice(-2);
				const winner = 	(sockets[0]._scores > sockets[1]._scores) ? 'Победитель: ' + sockets[0]._name : ((sockets[0]._scores < sockets[1]._scores) ? 'Победитель: ' + sockets[1]._name : 'Результат: ничья');
				
				// Создание массива для данной сложности в рекордах
				if (!records[diff]) records[diff] = [];
				
				sockets.forEach(s => {

					// Уведомления
					Notify(s.id, 'Игра завершена за ' + time + '!', winner, '', 'dark', 20000);
					Notify(s.id, 'Хотите сыграть ещё раз?', 'Обновите страницу (F5)', '', 'dark', 20000);
					s.emit('end', time);

					// Добавление рекорда
					if (s._scores > 0) records[diff].push({name: s._name, time: unixtime, image: url});
				});

				// Сортировка по времени
				records[diff].sort((a, b) => a.time - b.time);
				
				fs.writeFile('records.json', JSON.stringify(records), function (err) {
					if (err) console.log('Не получилось сохранить рекорды!', err);       
				});
			}
		});

		// Игрок отключился (будучи в игре)
		socket.on('disconnect', () => {
			
			// Удаление игрока из текущего объекта
			sockets.splice(index, 1);

			// Уведомление о выходе игрока для его противника
			sockets.forEach(one => Notify(one.id, 'Уведомление', 'Игрок ' + socket._name + ' покинул игру.', 'red'));
			if (!sockets.length) console.log('Игра закончена - все игроки отсоединились.');
		});
	});

	// Получает объект плитки по текущему индексу
	const GetTileAtIndex = (index) => tiles.find(tile => tile.now === index);

	// Проверка возможности смены двух плиток
	const Switch = (socket, tile1, tile2) => {

		// Если плитка отпущена там же где и подобрана - в принципе, это не ошибка
		if (tile1 === tile2) return false;

		// Если не нашлась плитка
		if (!tile2) return Notify(socket.id, 'Ошибка', 'Неправильный индекс.', 'red');

		// Если плитку destination, которую планировалось заменить плиткой socket._index, сейчас использует другой игрок
		if (tile2.taken) return Notify(socket.id, 'Ошибка', 'Плитка на той позиции используется другим игроком.', 'red');

		// Если эти плитки нельзя двигать
		if (tile1.now === tile1.init || tile2.now === tile2.init) return Notify(socket.id, 'Ошибка', 'Плитка уже установлена правильно', 'blue'); 

		return true;
	}
}

// Возвращает массив с информацией о счёте игроков
const Info = (sockets) => {
	let info = [];
	sockets.forEach(socket => info.push({name: socket._name, score: socket._scores}));
	return info;
}

// Уведомление игроку по Socket ID
const Notify = (id, title = '...', message = '', color = '', theme = 'white', timeout = 5000) => {
	console.log(id + ': ' + message);
	io.to(id).emit('notify', {title: title, message: message, color: color, theme: theme, timeout: timeout});
	return false;
}

// Остановка сервера с закрытием подключений
process.on('SIGTERM', Stop);
process.on('SIGINT', Stop);
process.on('SIGHUP', Stop);

async function Stop() {

	// Уведомление всем игрокам
	for (const [key, s] of Object.entries(io.sockets.sockets)) {
		Notify(s.id, 'Внимание', 'Сервер перезагружается, обновите страницу!', 'red');
	}

	console.log('Останавливаем процесс сервера...');
	const timeout = setTimeout(() => process.exit(1), 2000);

	try {
		await httpServer.close();
		console.log('Сервер успешно остановлен.')
		clearTimeout(timeout);
	} catch (error) {
		console.error(error, 'Произошла ошибка по ходу остановки.');
		process.exit(1);
	}
}

// Делает из небезопасной строки безопасную (для HTML)
const Escape = (unsafe) => {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Перемешивает массив
const Shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}