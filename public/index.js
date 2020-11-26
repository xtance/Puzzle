// Порт, на котором работает сервер node.js
const PORT = 5555;

let canvas, canvas_parent, stage, layer, timer, showtime, ts,
DIFF = 7, SIDE = 72, PIXELS_X = DIFF*SIDE, PIXELS_Y = DIFF*SIDE,
socket, gallery, difficulty, helper, names = [], scores = [];

// Показывает уведомление
window.Notify = (title, message = ' ', color = '', theme = '', timeout = 5000) => {
    iziToast.show({title: title, message: message, timeout: timeout, color: color, theme: theme});
}

// Событие, когда готова разметка страницы
document.addEventListener("DOMContentLoaded", function(event) {
    
    // Кэширование элементов
    canvas = document.getElementById('canvas');
    canvas_parent = document.getElementById('canvas_parent');
    gallery = document.getElementById('gallery');
    difficulty = document.getElementById('difficulty');
    helper = document.getElementById('helper');
    showtime = document.getElementById('showtime');
    names.push(document.getElementById('player0'));
    names.push(document.getElementById('player1'));
    scores.push(document.getElementById('player0_score'));
    scores.push(document.getElementById('player1_score'));

    // Выбор сложности
    difficulty.onchange = () => difficulty.value = DIFF = parseInt(difficulty.value);

    socket = io.connect(':' + PORT);
    socket.on('connect', () => {
        console.log('connected!');
    });

    socket.on('notify', (obj) => Notify(obj.title, obj.message, obj.color, obj.theme, obj.timeout));

    socket.on('start', (obj) => {
        DIFF = obj.diff;
        SetImage(obj.url, obj.r);
        document.getElementById('animation').style.display = 'none';
        document.getElementById('description').style.display = 'none';
        canvas_parent.style.display = 'inline';
        obj.info.forEach((player, index) => {
            names[index].innerHTML = player.name;
            scores[index].innerHTML = player.score;
        });
        document.getElementById('ingame').style.display = 'inline-block';
    });

    socket.on('scores', (info) => info.forEach((player, index) => {
        names[index].innerHTML = player.name;
        scores[index].innerHTML = player.score;
    }));

    socket.on('end', (time) => {
        clearInterval(timer);
        showtime.innerHTML = time;
    });

    socket.on('toggle_tile', (obj) => {
        let tile = GetTileAtIndex(obj.index);
        tile.draggable(obj.drag);
        console.log('Плитка ' + obj.index + ' -> ' + obj.drag);
    });

    socket.on('switch', (one, two, notify) => {

        let tile = GetTileAtIndex(one);
        
        if (one !== two) {
            let tile2 = GetTileAtIndex(two);
            tile2.setAttr('now', one);
            UpdateTile(tile2, 0.5, notify);
        }

        tile.setAttr('now', two);
        UpdateTile(tile, 0.5, notify);
        layer.draw();
    });

    // Стандартное значение сложности
    difficulty.value = DIFF = 5;
});

window.Search = () => {
    socket.emit('search', {name: document.getElementById('nickname').value, diff: difficulty.value});
    document.getElementById('search').style.display = 'none';
    document.getElementById('animation').style.display = 'inline';
    document.getElementById('description').innerHTML = '<i>Ожидание противника...</i>';
}

const AddImage = (url, scroll = false) => {
    let div = document.createElement('div');
    div.setAttribute('class', 'square');
    div.style.backgroundImage = 'url("' + encodeURI(url) + '")';
    div.onclick = () => {
        SetImage(url);
        canvas_parent.style.display = 'inline';
    }
    gallery.prepend(div);
    if (scroll) gallery.scrollIntoView();
}

// Получает индекс по позиции
const GetIndexAt = (pos) => {
    if (pos.x < 0 || pos.y < 0 || pos.x > DIFF*SIDE || pos.y > DIFF*SIDE){
        return -1;
    } else {
        let ox = parseInt(pos.x / SIDE);
        let oy = parseInt(pos.y / SIDE);
        return oy*DIFF+ox;
    }
}

// Случайное число в диапазоне
const GetRandomNumber = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Счётчик
const SetTime = () => {

    const unixtime = parseInt((+ new Date() - ts)/1000);
    const min = Math.floor((unixtime/60/60)*60);
    const sec = Math.floor(((unixtime/60/60)*60 - min)*60);

    showtime.innerHTML = ('0'+min).slice(-2) + ':' + ('0'+sec).slice(-2);
}

// Устанавливает картинку
const SetImage = (url, r) => {

    console.log(url);

    // Настройка размера canvas
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0) - 100;
    helper.width = helper.height = PIXELS_X = PIXELS_Y = (Math.min(vw, vh));
    SIDE = PIXELS_X / DIFF;
    console.log('Width: '+ vw + ', height: ' + vh + ', side: ' + SIDE);
    document.getElementById('helper_container').style.display = 'inline';

    // Заново устанавливаем эти переменные, на случай если изменилась сложность
    helper.width = PIXELS_X = DIFF*SIDE, helper.height = PIXELS_Y = DIFF*SIDE;

    //Стили
    canvas_parent.style.width = PIXELS_X + 'px';
    canvas_parent.style.height = PIXELS_Y + 'px';

    // Создание сцены и слоя
    if (stage) stage.destroy();
    stage = new Konva.Stage({container: canvas, width: PIXELS_X, height: PIXELS_Y, draggable: false});
    layer = new Konva.Layer();
    stage.add(layer);

    // Удаление прошлых объектов
    layer.destroyChildren();
    if (timer) clearInterval(timer);
    timer = setInterval(SetTime, 1000);
    ts = + new Date();

    let img = new Image();
    img.setAttribute("crossorigin", "anonymous");
    img.src = url;
    img.onload = function(){

        // Подгоняем картинку под PIXELS_X и PIXELS_Y на отдельном канвасе "helper"
        helper.getContext("2d").drawImage(img, 0, 0, img.width, img.height, 0, 0, PIXELS_X, PIXELS_Y);
        let img_new = new Image();
        img_new.src = helper.toDataURL();

        // DIFF * DIFF - квадрат
        for (let i = 0; i < DIFF; i++){
            for (let j = 0; j < DIFF; j++){
                
                let id = i*DIFF+j;
                let pic = new Konva.Image({
                    image: img_new, id: id.toString(),
                    x: j*SIDE, y: i*SIDE,
                    width: SIDE, height: SIDE,
                    crop: {x: j*SIDE, y: i*SIDE, width: SIDE, height: SIDE},
                    draggable: true, opacity: 0.9,
                    perfectDrawEnabled: false, shadowForStrokeEnabled: false, strokeWidth: 0,
                    dragBoundFunc: function (pos) {
                        return {
                            x: (pos.x < 0) ? 0 : ((pos.x + SIDE >= PIXELS_X) ? PIXELS_X - SIDE : pos.x),
                            y: (pos.y < 0) ? 0 : ((pos.y + SIDE >= PIXELS_Y) ? PIXELS_Y - SIDE : pos.y),
                        };
                    },
                });

                // Нажатие на картинку
                pic.on('click', function () {
                    if (pic.getAttr('now') === pic.getAttr('init')) Notify('', 'Плитка '+pic.getAttr('init')+' установлена правильно.', 'green');
                    else Notify('Плитка: '+pic.getAttr('init'), 'Переместите её на нужное место мышкой.', 'blue');
                });
                
                // Картинка взята мышкой - выдвигаем её наверх
                pic.on('dragstart', function () {
                    socket.emit('dragstart', pic.getAttr('now'));
                    pic.moveToTop();
                });

                // Картинка отпущена - по позиции курсора ищем её новый индекс
                pic.on('dragend', function () {
                    let destination = GetIndexAt(stage.getPointerPosition());
                    socket.emit('dragend', destination);
                });

                // Изначальные атрибуты картинки
                pic.setAttrs({
                    'init': id,     // изначальный индекс, если он совпал с now - картинка стоит на своём месте
                    'now': r[id]    // текущий индекс, от 0 до DIFF*DIFF+DIFF
                });

                // Добавление на слой, обновление свойств
                layer.add(pic);
                UpdateTile(pic, 1, false);
            }
        }

        layer.batchDraw();
    }
}

// Проверяет, существует ли такой индекс
const IsValidIndex = (index) => ((0 <= index) && (index < DIFF*DIFF)); 

// Обновляет картинку
const UpdateTile = (tile, duration = 0.1, say = false) => {

    // Получаем текущий индекс и двигаем туда картинку с анимацией
    let index = tile.getAttr('now');
    tile.to({
        x: GetX(index),
        y: GetY(index),
        duration: duration
    });

    // Если совпал индекс и изначальный индекс, картинка стоит правильно, запрещаем двигать
    if (index === tile.getAttr('init')){
        tile.draggable(false);
        tile.opacity(1);
        tile.stroke('green');
        tile.strokeWidth(2);
        setTimeout(() => tile.moveToTop(), 1500);
        if (tile.getAttr('now') === tile.getAttr('init')) {
            if (say) Notify('Ура!', 'Плитка ' + index + ' установлена правильно.', 'green');
        }
    }
}

// Получает картинку на индексе
const GetTileAtIndex = (index) => {
    let kids = layer.getChildren();
    for (let i  = 0; i < kids.length; i++) if (kids[i].getAttr('now') === index) return kids[i];
    return null;
}

// Получение X и Y в пикселях по индексу
const GetX = (index) => (index % DIFF) * SIDE;
const GetY = (index) => Math.floor(index / DIFF) * SIDE;

// Масштабирование сцены (для отладки)
const Scale = (node) => {
    node.oninput = function () {
        console.log(node.value);
        stage.scale({x: node.value, y: node.value});
        stage.batchDraw();
    }
}