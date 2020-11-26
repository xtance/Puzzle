let canvas, canvas_parent, stage, layer, counter = 0, helps = 0, timer, showtime,
MWIDTH = 7, MHEIGHT = 7,
SIDE = 72, PIXELS_X = MWIDTH*SIDE, PIXELS_Y = MHEIGHT*SIDE,
socket, gallery, difficulty, helper;

// Показывает уведомление
window.Notify = (title, message = ' ', color = '', theme = '') => {
    iziToast.show({title: title, message: message, timeout: 5000, color: color, theme: theme});
}

// Событие, когда готова разметка страницы
document.addEventListener("DOMContentLoaded", function(event) {
    
    // Кэширование элементов
    let selector = document.getElementById('selector');
    canvas = document.getElementById('canvas');
    canvas_parent = document.getElementById('canvas_parent');
    gallery = document.getElementById('gallery');
    difficulty = document.getElementById('difficulty');
    helper = document.getElementById('helper');
    showtime = document.getElementById('showtime');

    // Действия при загрузке фото
    document.getElementById('upload').onclick = () => selector.click();
    selector.onchange = () => {
        let file = selector.files[0];
        let reader = new FileReader();
        reader.onload = (e) => AddImage(e.target.result, true);
        reader.readAsDataURL(file);
    }

    // Создание галереи
    [
        './images/flowers.jpg',
        './images/graffiti.jpg',
        './images/hesburger.jpg',
        './images/keyboard.jpg',
        './images/kotiki.jpg',
        './images/mountain.jpg',
        './images/qiwi.jpg',
        './images/tourists.jpg',
        './images/water.jpg',
        './images/keyboard2.jpg',
        './images/retrowave.jpg',
        './images/neet.jpg',
    ].forEach(url => AddImage(url));

    // Выбор сложности
    difficulty.onchange = () => {
        MWIDTH = MHEIGHT = parseInt(difficulty.value);
        Notify('Сложность: ' + difficulty.value, 'Выберите картинку для применения!', 'green');
    }
    difficulty.value = MWIDTH;
});

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
    if (pos.x < 0 || pos.y < 0 || pos.x > MWIDTH*SIDE || pos.y > MHEIGHT*SIDE){
        return -1;
    } else {
        let ox = parseInt(pos.x / SIDE);
        let oy = parseInt(pos.y / SIDE);
        return oy*MWIDTH+ox;
    }
}

// Случайное число в диапазоне
const GetRandomNumber = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Перемешивает массив
const Shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Счётчик
const SetTime = (seconds) => {
    let min = Math.floor((seconds/60/60)*60);
    let sec = Math.floor(((seconds/60/60)*60 - min)*60);
    showtime.innerHTML = ('0'+min).slice(-2) + ':' + ('0'+sec).slice(-2);
    timer = setTimeout(SetTime, 1000, seconds+1);
}

// Устанавливает картинку
const SetImage = (url) => {

    // Настройка размера canvas
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0) - 100;
    helper.width = helper.height = PIXELS_X = PIXELS_Y = (Math.min(vw, vh));
    SIDE = PIXELS_X / MWIDTH;
    console.log('Width: '+ vw + ', height: ' + vh + ', side: ' + SIDE);

    // Заново устанавливаем эти переменные, на случай если изменилась сложность
    helper.width = PIXELS_X = MWIDTH*SIDE, helper.height = PIXELS_Y = MHEIGHT*SIDE;

    //Стили
    canvas_parent.style.width = PIXELS_X + 'px';
    canvas_parent.style.height = PIXELS_Y + 'px';

    // Создание сцены и слоя
    if (stage) stage.destroy();
    stage = new Konva.Stage({container: canvas, width: PIXELS_X, height: PIXELS_Y, draggable: false});
    layer = new Konva.Layer();
    stage.add(layer);

    // Обнуление счётчиков, удаление прошлых объектов
    counter = helps = 0;
    layer.destroyChildren();
    if (timer) clearTimeout(timer);
    timer = setTimeout(SetTime, 1000, 1);

    let img = new Image();
    img.setAttribute("crossorigin", "anonymous");
    img.src = url;
    img.onload = function(){

        // Подгоняем картинку под PIXELS_X и PIXELS_Y на отдельном канвасе "helper"
        helper.getContext("2d").drawImage(img, 0, 0, img.width, img.height, 0, 0, PIXELS_X, PIXELS_Y);
        let img_new = new Image();
        img_new.src = helper.toDataURL();

        // Массив из случайных чисел
        let r = Shuffle(Array.from(Array(MHEIGHT*MWIDTH).keys()));

        // MWIDTH * MWIDTH - квадрат
        for (let i = 0; i < MWIDTH; i++){
            for (let j = 0; j < MWIDTH; j++){
                
                let id = i*MWIDTH+j;
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

                pic.on('click', function () {
                    if (pic.getAttr('now') === pic.getAttr('init')) Notify('', 'Плитка '+pic.getAttr('init')+' установлена правильно.', 'green');
                    else Notify('Плитка: '+pic.getAttr('init'), 'Переместите её на нужное место мышкой.', 'blue');
                });
                
                // Картинка взята мышкой - выдвигаем её наверх
                pic.on('dragstart', function () {
                    pic.moveToTop();
                });

                // Картинка отпущена - по позиции курсора ищем её новый индекс
                pic.on('dragend', function () {
                    let destination = GetIndexAt(stage.getPointerPosition());
                    ChangeTileIndex(pic, destination);
                    layer.draw();
                });

                // Изначальные атрибуты картинки
                pic.setAttrs({
                    'init': id,     // изначальный индекс, если он совпал с now - картинка стоит на своём месте
                    'now': r[id]    // текущий индекс, от 0 до MHEIGHT*MWIDTH+MWIDTH
                });

                // Добавление на слой, обновление свойств
                layer.add(pic);
                UpdateTile(pic, 1, false);
            }
        }

        layer.batchDraw();
        document.getElementById('upload').scrollIntoView();
    }
}

// Проверяет, существует ли такой индекс
const IsValidIndex = (index) => ((0 <= index) && (index < MHEIGHT*MWIDTH)); 

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
        if (tile.getAttr('init') === tile.getAttr('now')) {
            if (say) Notify('Ура!', 'Плитка ' + index + ' установлена правильно.', 'green');
            counter++;
        }
    }

    if (counter === MWIDTH*MWIDTH){
        if (timer) clearTimeout(timer);
        Notify('Поздравляем!','Вы собрали пазл!','','dark');
        Notify('Время: ' + showtime.innerHTML, 'Подсказки: ' + helps, '', 'dark');
    }
}

// Получает картинку на индексе
const GetTileAtIndex = (index) => {
    let kids = layer.getChildren();
    for (let i  = 0; i < kids.length; i++) if (kids[i].getAttr('now') === index) return kids[i];
    return null;
}

// Изменение индекса картинки
const ChangeTileIndex = (tile, where) => {

    // Получение картинки на том месте, куда хотим переместить
    let tile2 = GetTileAtIndex(where);

    if (tile.getAttr('init') === tile.getAttr('now')){

        // Если каким-то образом пользователь переместил плитку, которую перемещать нельзя
        // Мы ничего не делаем и просто возвращаем её на своё место

    } else if (!IsValidIndex(where)){

        // Это вызывается, если пользователь ведёт мышкой за пределами таблицы
        console.log('Неправильный индекс!');

    } else if (!tile2){ 

        // На нужном нам месте пусто - туда можно переместить
        tile.setAttr('now', where);
        UpdateTile(tile, 0.5, true);

    } else if (tile2.getAttr('init') !== tile2.getAttr('now')){

        // Меняем местами атрибуты, если вторую картинку можно передвигать, т.е. она стоит неправильно
        tile2.setAttr('now', tile.getAttr('now'));
        tile.setAttr('now', where);
        UpdateTile(tile2, 0.5, true);

    } else Notify('Плитка уже установлена правильно!','Её позицию нельзя занять.');

    // В любом случае, обновляем картинку - она либо заняла новый индекс, либо вернулась на свой
    UpdateTile(tile, 0.5, true);
}

// Получение X и Y в пикселях по индексу
const GetX = (index) => (index % MWIDTH) * SIDE;
const GetY = (index) => Math.floor(index / MWIDTH) * SIDE;

// Масштабирование сцены (для отладки)
const Scale = (node) => {
    node.oninput = function () {
        console.log(node.value);
        stage.scale({x: node.value, y: node.value});
        stage.batchDraw();
    }
}

// Автоматическое решение пазла (для отладки)
window.Solve = () => {
    if (!layer) return Notify('Ошибка', 'Вначале выберите картинку', 'red');
    let kids = layer.getChildren();
    for (let i  = 0; i < kids.length; i++) {
        if (kids[i].getAttr('now') !== kids[i].getAttr('init')) {
            helps++;
            ChangeTileIndex(kids[i], kids[i].getAttr('init'));
        }
    }
    return 'OK';
}

// Подсказка (проводит линию между двумя плитками)
window.Help = () => {
    if (!layer) return Notify('Ошибка', 'Вначале выберите картинку', 'red');
    
    const tile = GetTileAtIndex(GetRandomNumber(0, MWIDTH*MHEIGHT));
    const tile2 = GetTileAtIndex(tile.getAttr('init'));

    if (tile === tile2) return Notify('Ошибка', 'Попробуйте ещё раз', 'red');

    const box1 = tile.getClientRect();
    const box2 = tile2.getClientRect();

    let line = new Konva.Line({
        points: [box1.x + box1.width / 2, box1.y + box1.height / 2, box2.x + box2.width / 2, box2.y + box2.height / 2],
        stroke: 'black',
        strokeWidth: 3,
        dash: [10, 10]
    });

    layer.add(line);
    layer.draw();

    setTimeout(() => {
        line.destroy();
        layer.draw();
    }, 3000);

    helps++;
}