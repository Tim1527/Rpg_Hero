// Инициализация 3D сцены
let scene, camera, renderer, controls, model;
let isLevelingUp = false;
let rotationProgress = 0;
const rotationDuration = 2; // секунды
let originalYPosition = -1.5;
const clock = new THREE.Clock();

function animateLevelUp(deltaTime) {
    if (!isLevelingUp || !model) return;

    rotationProgress += deltaTime;
    const progress = Math.min(rotationProgress / rotationDuration, 1);

    // Вычисляем текущий угол вращения (0-2π)
    const angle = progress * Math.PI * 2;

    // Вычисляем вертикальное положение (подъем в первой половине, спуск во второй)
    const verticalProgress = progress < 0.5 ?
        progress * 2 :
        1 - (progress - 0.5) * 2;
    const verticalOffset = verticalProgress * 1.5;

    // Применяем трансформации к модели
    model.rotation.y = -Math.PI / 1.65 + angle; // Сохраняем начальный поворот
    model.position.y = originalYPosition + verticalOffset;

    // Завершение анимации
    if (progress >= 1) {
        isLevelingUp = false;
        model.position.y = originalYPosition; // Возвращаем исходную позицию
    }
}

function init3DViewer() {
    const container = document.getElementById('model-viewer');
    const errorMessage = document.getElementById('error-message');

    // Создание сцены
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Камера
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    // Рендерер
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Орбитальные контролы для вращения
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    // Освещение
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Загрузка модели
    loadModel();

    // Анимация
    function animate() {
        requestAnimationFrame(animate);
        const deltaTime = clock.getDelta();

        animateLevelUp(deltaTime);
        controls.update();
        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    animate();
}

function loadModel() {
    const errorMessage = document.getElementById('error-message');
    const loader = new THREE.GLTFLoader();

    loader.load(
        '/model',
        function(gltf) {
            model = gltf.scene;
            scene.add(model);

            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);

            model.position.y = originalYPosition - 0.45;
            model.rotation.y = -Math.PI / 1.65;

            const size = box.getSize(new THREE.Vector3()).length();
            camera.position.z = size;
            camera.position.y = size * 0.5;
            controls.update();
        },
        undefined,
        function(error) {
            console.error('Ошибка загрузки модели:', error);
            errorMessage.style.display = 'block';
        }
    );
}

function loadStats() {
    fetch('/get_stats')
        .then(response => {
            if (!response.ok) throw new Error('Network error');
            return response.json();
        })
        .then(data => {
            const container = document.getElementById('stats-container');
            container.innerHTML = '';

            for (const [category, stats] of Object.entries(data)) {
                if (category === "total_level") continue;

                const section = document.createElement('div');
                section.className = 'stats-section';
                section.innerHTML = `<h2>${category}</h2>`;

                for (const [statName, statData] of Object.entries(stats)) {
                    const statDiv = document.createElement('div');
                    statDiv.className = 'stat';

                    let markers = '';
                    for (let i = 1; i < statData.current_max; i++) {
                        markers += `<div class="progress-marker" style="left: ${(i/statData.current_max)*100}%"></div>`;
                    }

                    statDiv.innerHTML = `
                        <div class="stat-label">
                            <div class="level-badge">${statData.level}</div>
                            ${statName}
                        </div>
                        <div class="progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${(statData.value/statData.current_max)*100}%"></div>
                                ${markers}
                            </div>
                            <div class="progress-value">${statData.value}/${statData.current_max}</div>
                        </div>
                        <div class="progress-actions">
                            <button onclick="updateStat('${category}', '${statName}', -1)">-</button>
                            <button onclick="updateStat('${category}', '${statName}', 1)">+</button>
                        </div>
                    `;

                    section.appendChild(statDiv);
                }
                container.appendChild(section);
            }
        })
        .catch(error => {
            console.error("Ошибка загрузки статистики:", error);
            document.getElementById('stats-container').innerHTML =
                '<p style="color:red">Ошибка загрузки прогресса. Перезагрузите страницу.</p>';
        });
}

function updateStat(category, stat, change) {
    const dateInput = document.getElementById('global-date-input').value;

    fetch('/update_stat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            category: category,
            stat: stat,
            change: change,
            date: dateInput
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadStats();
            updateTotalLevel(data.total_level);

            if (data.level_up && model) {
                const totalLevelElement = document.getElementById('total-level');
                totalLevelElement.classList.add('level-up');
                setTimeout(() => {
                    totalLevelElement.classList.remove('level-up');
                }, 3000);

                // Запускаем анимацию уровня
                isLevelingUp = true;
                rotationProgress = 0;
            }
        }
    });
}

function updateTotalLevel(level) {
    document.getElementById('total-level').textContent = `Общий уровень: ${level}`;
}

window.onload = function() {
    console.log("Страница загружена");
    init3DViewer();
    loadStats();
    document.getElementById('global-date-input').value = new Date().toISOString().split('T')[0];
};