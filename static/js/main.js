// Инициализация 3D сцены
let scene, camera, renderer, controls, model;
let isLevelingUp = false;
let rotationProgress = 0;
const rotationDuration = 2;
let originalYPosition = -1.5;
const clock = new THREE.Clock();

// Элементы звуков
const audioUp = document.getElementById('up-sound');
const audioDown = document.getElementById('down-sound');
const audioLevelUp = document.getElementById('levelup-sound');

// График
let chart = null;

// Анимация повышения уровня
function animateLevelUp(deltaTime) {
    if (!isLevelingUp || !model) return;

    rotationProgress += deltaTime;
    const progress = Math.min(rotationProgress / rotationDuration, 1);
    const angle = progress * Math.PI * 2;
    const verticalProgress = progress < 0.5 ? progress * 2 : 1 - (progress - 0.5) * 2;
    const verticalOffset = verticalProgress * 1.5;

    model.rotation.y = -Math.PI / 1.65 + angle;
    model.position.y = originalYPosition + verticalOffset;

    if (progress >= 1) {
        isLevelingUp = false;
        model.position.y = originalYPosition;
    }
}

// Инициализация 3D viewer
function init3DViewer() {
    const container = document.getElementById('model-viewer');
    const errorMessage = document.getElementById('error-message');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    loadModel();

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

// Загрузка 3D модели
function loadModel() {
    const errorMessage = document.getElementById('error-message');
    const loader = new THREE.GLTFLoader();

    loader.load(
        '/model',
        (gltf) => {
            model = gltf.scene;
            scene.add(model);

            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);

            model.position.y = originalYPosition;
            model.rotation.y = -Math.PI / 1.65;

            const size = box.getSize(new THREE.Vector3()).length();
            camera.position.z = size;
            camera.position.y = size * 0.5;
            controls.update();
        },
        undefined,
        (error) => {
            console.error('Ошибка загрузки модели:', error);
            errorMessage.textContent = 'Файл модели не найден. Убедитесь, что model.glb находится в папке проекта';
            errorMessage.style.display = 'block';
        }
    );
}

// Функции для работы с графиком
function openChartModal() {
    document.getElementById('chart-modal').style.display = 'block';
    loadChartData('week');
}

function closeChartModal() {
    document.getElementById('chart-modal').style.display = 'none';
    if (chart) {
        chart.destroy();
        chart = null;
    }
}

function loadChartData(range) {
    document.querySelectorAll('.time-filters button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    const chartContainer = document.getElementById('chart-container');
    chartContainer.innerHTML = '<div style="color: white; text-align: center; padding: 20px;">Загрузка данных...</div>';

    fetch(`/get_history?range=${range}`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (!data.success) throw new Error(data.error || "Unknown server error");
            if (data.logs.length === 0) {
                chartContainer.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Нет данных за выбранный период</div>';
                return;
            }
            renderChart(data.logs, range);
        })
        .catch(error => {
            console.error("Ошибка загрузки графика:", error);
            chartContainer.innerHTML = `
                <div style="color: #ff6b6b; text-align: center; padding: 20px;">
                    Ошибка: ${error.message}<br>
                    <small>Проверьте консоль для подробностей</small>
                </div>
            `;
        });
}



function renderChart(logs, range) {
    const canvas = document.getElementById('chart-container');
    if (!canvas) return;

    // Очищаем предыдущий график
    if (chart) {
        chart.destroy();
        chart = null;
    }

    // Фиксируем размеры canvas
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 500;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Подготовка данных
    const datasets = {};
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40', '#8AC24A', '#607D8B'
    ];

    logs.forEach(log => {
        const parts = log.split(' | ');
        if (parts.length < 6) return;

        const [dateStr, category, stat, changeStr, valueStr, levelStr] = parts;
        const statName = `${category} - ${stat}`;

        const valueParts = valueStr.split(': ')[1].split('/');
        const currentValue = parseInt(valueParts[0]);
        const level = parseInt(levelStr.split(': ')[1]);
        const date = new Date(dateStr.replace(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/, '$1-$2-$3T$4:$5:$6'));

        if (isNaN(currentValue)) return;

        if (!datasets[statName]) {
            datasets[statName] = {
                label: statName,
                data: [],
                borderColor: colors[Object.keys(datasets).length % colors.length],
                backgroundColor: 'rgba(0,0,0,0.1)',
                borderWidth: 2,
                tension: 0,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: colors[Object.keys(datasets).length % colors.length],
                pointRadius: 3, // Стандартный размер точек
                pointHoverRadius: 6, // Размер при наведении
                pointHitRadius: 6 // Зона взаимодействия
            };
        }

        datasets[statName].data.push({
            x: date,
            y: currentValue + (level * 10),
            change: changeStr.split(': ')[1],
            rawValue: currentValue,
            level: level,
            date: dateStr,
            stat: stat,
            category: category
        });
    });

    // Сортируем данные по дате
    Object.values(datasets).forEach(dataset => {
        dataset.data.sort((a, b) => a.x - b.x);
    });

    // Настройки графика
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: Object.values(datasets)
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: range === 'week' ? 'day' :
                              range === 'month' ? 'week' :
                              range === 'half_year' ? 'month' :
                              range === 'year' ? 'month' : 'year',
                        tooltipFormat: 'dd.MM.yyyy HH:mm'
                    },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#FFF' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: {
                        color: '#FFF',
                        callback: function(value) {
                            const level = Math.floor(value / 10);
                            const progress = value % 10;
                            return `Ур.${level} (${progress})`;
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#FFF',
                        font: { size: 14 },
                        boxWidth: 20,
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    enabled: true,
                    intersect: false,
                    mode: 'point', // Режим одной точки
                    position: 'nearest',
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    borderColor: '#4CAF50',
                    borderWidth: 1,
                    caretSize: 8,
                    displayColors: false,
                    padding: 12,
                    callbacks: {
                        title: (context) => {
                            return context[0].raw.date;
                        },
                        label: (context) => {
                            const raw = context.raw;
                            return [
                                `Категория: ${raw.category}`,
                                `Навык: ${raw.stat}`,
                                `Уровень: ${raw.level}`,
                                `Прогресс: ${raw.rawValue}/${raw.y % 10 + raw.rawValue}`,
                                `Изменение: ${raw.change}`
                            ];
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'point', // Точное взаимодействие с точками
                axis: 'xy'
            },
            elements: {
                point: {
                    radius: 3,
                    hoverRadius: 6,
                    hitRadius: 10,
                    borderWidth: 2
                },
                line: {
                    tension: 0.1,
                    borderWidth: 2,
                    fill: false
                }
            }
        }
    });

    // Кастомная обработка наведения
    let lastHoveredIndex = -1;
    let lastHoveredDataset = -1;

    canvas.addEventListener('mousemove', (e) => {
        if (!chart) return;

        const activePoints = chart.getElementsAtEventForMode(
            e,
            'point', // Режим точного попадания
            { intersect: false },
            false
        );

        // Сбрасываем предыдущее выделение
        if (lastHoveredIndex !== -1 && lastHoveredDataset !== -1) {
            chart.data.datasets[lastHoveredDataset].pointRadius = 3;
        }

        // Применяем новое выделение
        if (activePoints.length > 0) {
            const point = activePoints[0];
            chart.data.datasets[point.datasetIndex].pointRadius = 6;
            lastHoveredIndex = point.index;
            lastHoveredDataset = point.datasetIndex;
        } else {
            lastHoveredIndex = -1;
            lastHoveredDataset = -1;
        }

        chart.update('none'); // Обновляем без анимации
    });

    canvas.addEventListener('mouseout', () => {
        if (!chart) return;

        // Сбрасываем все выделения
        chart.data.datasets.forEach(dataset => {
            dataset.pointRadius = 3;
        });

        chart.update('none');
    });
}

// Загрузка статистики
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

// Обновление статистики
function updateStat(category, stat, change) {
    const dateInput = document.getElementById('global-date-input');
    let selectedDate;

    try {
        selectedDate = new Date(dateInput.value);
        if (isNaN(selectedDate.getTime())) throw new Error("Invalid date");
    } catch (e) {
        console.warn("Некорректная дата, используем текущую", e);
        selectedDate = new Date();
        dateInput.value = selectedDate.toISOString().split('T')[0];
    }

    fetch('/update_stat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            category: category,
            stat: stat,
            change: change,
            date: selectedDate.toISOString().split('T')[0]
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            try {
                if (change > 0) {
                    audioUp.currentTime = 0;
                    audioUp.play().catch(e => console.log("Не удалось воспроизвести звук:", e));
                } else {
                    audioDown.currentTime = 0;
                    audioDown.play().catch(e => console.log("Не удалось воспроизвести звук:", e));
                }
            } catch (e) {
                console.log("Ошибка воспроизведения звука:", e);
            }

            loadStats();
            updateTotalLevel(data.total_level);

            if (data.level_up && model) {
                try {
                    audioLevelUp.currentTime = 0;
                    audioLevelUp.play().catch(e => console.log("Не удалось воспроизвести звук уровня:", e));
                } catch (e) {
                    console.log("Ошибка воспроизведения звука уровня:", e);
                }

                const totalLevelElement = document.getElementById('total-level');
                totalLevelElement.classList.add('level-up');
                setTimeout(() => {
                    totalLevelElement.classList.remove('level-up');
                }, 3000);

                isLevelingUp = true;
                rotationProgress = 0;
            }
        }
    })
    .catch(error => {
        console.error("Ошибка при обновлении статистики:", error);
    });
}

// Обновление общего уровня
function updateTotalLevel(level) {
    document.getElementById('total-level').textContent = `Общий уровень: ${level}`;
}

// Инициализация при загрузке страницы
window.onload = function() {
    init3DViewer();
    loadStats();
    document.getElementById('global-date-input').value = new Date().toISOString().split('T')[0];

    document.querySelector('.close').addEventListener('click', closeChartModal);
    window.addEventListener('click', (event) => {
        if (event.target === document.getElementById('chart-modal')) {
            closeChartModal();
        }
    });

    [audioUp, audioDown, audioLevelUp].forEach(audio => {
        audio.volume = 0.7;
    });

    // Ресайз графика при изменении окна
    window.addEventListener('resize', () => {
        if (chart) {
            const canvas = document.getElementById('chart-container');
            canvas.width = canvas.parentElement.clientWidth;
            chart.resize();
        }
    });
};