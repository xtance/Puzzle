// Порт, на котором работает сервер node.js
const PORT = 5555;

// Событие полной загрузки страницы
document.addEventListener("DOMContentLoaded", function(event) {
   
    // Запрашиваем рекорды с сервера
    socket = io.connect(':' + PORT);
    socket.emit('records');
    let container = document.getElementById('container');
    
    // Получаем объекты с рекордами
    socket.on('records', (obj) => {

        console.log(obj);
        let div = document.createElement('div');
        div.setAttribute('class', 'card-deck mb-3 text-center');
        container.appendChild(div);
        let count = 0;

        // Создание разметки
        Object.entries(obj).forEach(([key, value]) => {
            if (value.length){

                const card = document.createElement('div');
                card.setAttribute('class', 'card mb-4 shadow-sm');

                const header = document.createElement('div');
                header.setAttribute('class', 'card-header');

                const h4 = document.createElement('h4');
                h4.setAttribute('class', 'my-0 font-weight-normal');
                h4.innerHTML = key + '*' + key;

                const flex = document.createElement('div');
                flex.setAttribute('class', 'card-body flex2');

                value.forEach(record => {
                    const name = document.createElement('div');
                    name.setAttribute('class', 'record');
                    name.innerHTML = record.name;
                    
                    const time = document.createElement('div');
                    time.setAttribute('class', 'record');
                    time.innerHTML = UnixTimeToDate(record.time);

                    const image = document.createElement('a');
                    image.innerHTML = record.image.replace('./images/', '');
                    image.href = record.image;
                    image.setAttribute('class', 'record');
                   
                    flex.appendChild(name);
                    flex.appendChild(time);
                    flex.appendChild(image);
                });
                
                header.appendChild(h4);
                card.appendChild(header);
                card.appendChild(flex);

                div.appendChild(card);
                count++;
            }
            if (count == 2){
                div = document.createElement('div');
                div.setAttribute('class', 'card-deck mb-3 text-center');
                container.appendChild(div);
                count = 0;
            }
        });
    });
});

// Преобразовывание секунд (125) в читаемую строку (2:05)
const UnixTimeToDate = (unixtime) => {
    const min = Math.floor((unixtime/60/60)*60);
    const sec = Math.floor(((unixtime/60/60)*60 - min)*60);
    return ('0'+min).slice(-2) + ':' + ('0'+sec).slice(-2);
}