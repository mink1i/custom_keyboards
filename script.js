import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const container = document.getElementById('preview-container');
container.innerHTML = ''; 

const scene = new THREE.Scene();

// Настройка камеры
const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
camera.position.set(0, 2, 4); 

// Настройка рендерера
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Настройка управления (зум и вращение)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false; 
controls.minDistance = 1;
controls.maxDistance = 10;

// Освещение сцены
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

window.keyboardModel = null;
const loader = new GLTFLoader();

// Создаем постоянную невидимую группу-обертку на сцене
const wrapper = new THREE.Group();
scene.add(wrapper);

// Создаем глобальную функцию загрузки, которую можно вызывать из HTML
window.loadModel = function(filename) {
    // Если на экране уже есть клавиатура - удаляем её
    if (window.keyboardModel) {
        wrapper.remove(window.keyboardModel);
    }

    // Полностью обнуляем сжатие коробки перед новой моделью!
    wrapper.scale.set(1, 1, 1);

    // Загружаем новую клавиатуру
    loader.load(`models/${filename}`, (gltf) => {
        window.keyboardModel = gltf.scene;
        
        // СНАЧАЛА вычисляем чистые размеры, ДО помещения в обертку
        const box = new THREE.Box3().setFromObject(window.keyboardModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // ТЕПЕРЬ кладем модель в обертку
        wrapper.add(window.keyboardModel);
        
        // Центрируем
        window.keyboardModel.position.x = -center.x;
        window.keyboardModel.position.y = -center.y;
        window.keyboardModel.position.z = -center.z;

        // Вычисляем и применяем новый масштаб
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
            const scale = 5 / maxDim;
            wrapper.scale.set(scale, scale, scale);
        }

        //Возвращаем камеру на исходную позицию, чтобы не приходилось искать модель
        camera.position.set(0, 2, 4);
        controls.target.set(0, 0, 0);
        controls.update();

        // После загрузки вызываем покраску
        if (typeof window.applyCurrentColors === 'function') {
            window.applyCurrentColors();
        }

        console.log(`Модель ${filename} идеально загрузилась!`);
    }, undefined, (error) => {
        console.error('Ошибка загрузки модели:', error);
    });
};

// Загружаем 100% модель при первом открытии страницы
window.loadModel('key100.gltf');

// Анимация сцены
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Клик по отдельным деталям
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerdown', (event) => {
    // Находим наш контейнер с 3D сценой
    const container = document.getElementById('preview-container');
    if (!container) return;

    // Вычисляем координаты контейнера на экране
    const rect = container.getBoundingClientRect();
    
    // Проверяем, что клик был именно внутри 3D-окна
    if (event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom) {
        
        // Переводим координаты мыши в формат Three.js (от -1 до 1)
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Стреляем лучом от камеры
        raycaster.setFromCamera(mouse, camera);

        if (window.keyboardModel) {
            // Ищем все объекты, которые проткнул луч
            const intersects = raycaster.intersectObject(window.keyboardModel, true);
            
            if (intersects.length > 0) {
                // Берем самую первую деталь, в которую попали
                const clickedMesh = intersects[0].object;
                
                // Отправляем сигнал в HTML, что мы кликнули по детали
                window.dispatchEvent(new CustomEvent('meshClicked', { detail: clickedMesh }));
            }
        }
    }
});

// ИНТЕРАКТИВНОСТЬ: Двойной клик (Ластик)
window.addEventListener('dblclick', (event) => {
    const container = document.getElementById('preview-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom) {
        
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        if (window.keyboardModel) {
            const intersects = raycaster.intersectObject(window.keyboardModel, true);
            if (intersects.length > 0) {
                const clickedMesh = intersects[0].object;
                // Отправляем специальный сигнал о двойном клике
                window.dispatchEvent(new CustomEvent('meshDoubleClicked', { detail: clickedMesh }));
            }
        }
    }
});

// Подстройка размера канваса при изменении окна браузера
window.addEventListener('resize', () => {
    if (!container.clientWidth) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});