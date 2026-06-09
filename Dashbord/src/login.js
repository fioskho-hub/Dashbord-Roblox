const container = document.getElementById('grid-container');

const rows = Math.ceil(window.innerHeight / 40);
const cols = Math.ceil(window.innerWidth / 40);
const totalBoxes = rows * cols;

for (let i = 0; i < totalBoxes; i++) {
    const box = document.createElement('div');
    box.classList.add('grid-box');


    box.addEventListener('mouseenter', () => {
        box.style.transition = '0s';
        box.style.backgroundColor = '#5865F2'; 
        box.style.boxShadow = '0 0 10px #5865F2, 0 0 20px #5865F2';
    });

    box.addEventListener('mouseleave', () => {
        box.style.transition = '1s ease'; 
        box.style.backgroundColor = 'transparent';
        box.style.boxShadow = 'none';
    });

    container.appendChild(box);
}