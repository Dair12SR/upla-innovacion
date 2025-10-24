// ==================== CONFIGURACIÓN ====================
const API_URL = 'https://upla-innovacion-backend.azurewebsites.net/api';
let currentUser = null;
let currentProjectForEvaluation = null;

// ==================== AUTENTICACIÓN ====================
async function login(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert('Por favor complete todos los campos');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            currentUser = data.user;
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('dashboard-section').style.display = 'block';
            document.getElementById('user-email').textContent = currentUser.email;
            loadProjects();
        } else {
            alert('Error al iniciar sesión');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión. Verifica que el servidor backend esté corriendo.');
    }
}

function logout() {
    currentUser = null;
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('dashboard-section').style.display = 'none';
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
}

// ==================== PROYECTOS ====================
async function loadProjects() {
    try {
        const response = await fetch(`${API_URL}/projects`);
        const projects = await response.json();

        const container = document.getElementById('projects-container');
        container.innerHTML = '';

        if (projects.length === 0) {
            container.innerHTML = '<p class="no-projects">No hay proyectos registrados. ¡Crea el primero!</p>';
            return;
        }

        projects.forEach(project => {
            const card = createProjectCard(project);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('projects-container').innerHTML = 
            '<p class="no-projects">Error al cargar proyectos</p>';
    }
}

function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';
    
    // ✅ Verificar si tiene evaluación y mostrar badge
    const evaluationBadge = project.has_evaluation 
        ? `<span class="evaluation-badge">✅ Evaluado (${project.total_score || 0} pts)</span>` 
        : '';
    
    card.innerHTML = `
        <div class="project-header">
            <span class="project-category">${project.category}</span>
            <button onclick="deleteProject('${project.id}')" class="btn-delete">🗑️</button>
        </div>
        ${evaluationBadge}
        <h3>${project.name}</h3>
        <p><strong>Tipo:</strong> ${project.type}</p>
        <p><strong>Investigadores:</strong> ${project.researchers}</p>
        <p><strong>Programa:</strong> ${project.study_program}</p>
        <p><strong>Línea:</strong> ${project.research_line}</p>
        <p><strong>Contacto:</strong> ${project.contact_email}</p>
        ${project.file_url ? `<a href="http://localhost:3000${project.file_url}" target="_blank" class="btn-file">📄 Ver documento</a>` : ''}
        <button onclick='openEvaluationModal(${JSON.stringify(project).replace(/'/g, "\\'")})'  class="btn-evaluate">⭐ Evaluar Proyecto</button>
    `;
    return card;
}

async function deleteProject(id) {
    if (!confirm('¿Estás seguro de eliminar este proyecto?')) return;

    try {
        await fetch(`${API_URL}/projects/${id}`, { method: 'DELETE' });
        alert('Proyecto eliminado exitosamente');
        loadProjects();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar proyecto');
    }
}

// ==================== NUEVO PROYECTO ====================
function openNewProjectModal() {
    document.getElementById('new-project-modal').style.display = 'flex';
}

function closeNewProjectModal() {
    document.getElementById('new-project-modal').style.display = 'none';
    document.getElementById('new-project-form').reset();
}

async function submitNewProject(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    formData.append('user_id', currentUser.id);

    try {
        const response = await fetch(`${API_URL}/projects`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            alert('✅ Proyecto registrado exitosamente');
            closeNewProjectModal();
            loadProjects();
        } else {
            alert('❌ Error al registrar proyecto');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error de conexión');
    }
}

// ==================== EVALUACIÓN ====================
function openEvaluationModal(project) {
    currentProjectForEvaluation = project;
    
    // Mostrar info del proyecto
    document.getElementById('evaluation-project-info').innerHTML = `
        <h3>${project.name}</h3>
        <p><strong>Categoría:</strong> ${project.category}</p>
        <p><strong>Investigadores:</strong> ${project.researchers}</p>
        <p><strong>Programa:</strong> ${project.study_program}</p>
    `;
    
    document.getElementById('eval-project-id').value = project.id;
    document.getElementById('evaluation-modal').style.display = 'flex';
    
    // ✅ Cargar evaluación existente si hay
    loadEvaluation(project.id);
}

function closeEvaluationModal() {
    document.getElementById('evaluation-modal').style.display = 'none';
    document.getElementById('evaluation-form').reset();
    document.getElementById('total-score').textContent = '0.00';
    currentProjectForEvaluation = null;
}

function calculateTotal() {
    const form = document.getElementById('evaluation-form');
    const inputs = form.querySelectorAll('input[type="number"]');
    
    let total = 0;
    inputs.forEach(input => {
        const value = parseFloat(input.value) || 0;
        total += value;
    });
    
    document.getElementById('total-score').textContent = total.toFixed(2);
}

async function submitEvaluation(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {};
    
    formData.forEach((value, key) => {
        data[key] = value;
    });
    
    // Agregar evaluator_id
    data.evaluator_id = currentUser.id;
    
    // ✅ Calcular total automáticamente
    let total = 0;
    Object.keys(data).forEach(key => {
        if (key.match(/^eval\d+_\d+$/)) {
            total += parseFloat(data[key]) || 0;
        }
    });
    data.total_score = total.toFixed(2);

    try {
        const response = await fetch(`${API_URL}/evaluations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('✅ Evaluación guardada exitosamente\nPuntaje Total: ' + data.total_score + ' / 55 pts');
            closeEvaluationModal();
            loadProjects(); // ✅ RECARGAR PROYECTOS PARA MOSTRAR BADGE
        } else {
            const error = await response.json();
            alert('❌ Error: ' + (error.error || 'No se pudo guardar la evaluación'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error de conexión al guardar evaluación');
    }
}

// ✅ CARGAR EVALUACIÓN EXISTENTE
async function loadEvaluation(projectId) {
    try {
        const response = await fetch(`${API_URL}/evaluations/${projectId}`);
        if (response.ok) {
            const evaluation = await response.json();
            
            // Llenar el formulario con los datos guardados
            document.querySelector('[name="eval1_1"]').value = evaluation.eval1_1 || 0;
            document.querySelector('[name="eval1_2"]').value = evaluation.eval1_2 || 0;
            document.querySelector('[name="eval1_3"]').value = evaluation.eval1_3 || 0;
            document.querySelector('[name="eval1_4"]').value = evaluation.eval1_4 || 0;
            document.querySelector('[name="eval1_5"]').value = evaluation.eval1_5 || 0;
            document.querySelector('[name="eval2_1"]').value = evaluation.eval2_1 || 0;
            document.querySelector('[name="eval2_2"]').value = evaluation.eval2_2 || 0;
            document.querySelector('[name="eval2_3"]').value = evaluation.eval2_3 || 0;
            document.querySelector('[name="eval3_1"]').value = evaluation.eval3_1 || 0;
            document.querySelector('[name="eval3_2"]').value = evaluation.eval3_2 || 0;
            document.querySelector('[name="eval3_3"]').value = evaluation.eval3_3 || 0;
            document.querySelector('[name="eval3_4"]').value = evaluation.eval3_4 || 0;
            document.querySelector('[name="obs1"]').value = evaluation.obs1 || '';
            document.querySelector('[name="obs2"]').value = evaluation.obs2 || '';
            document.querySelector('[name="obs3"]').value = evaluation.obs3 || '';
            document.querySelector('[name="final_recommendations"]').value = evaluation.final_recommendations || '';
            
            // Calcular y mostrar total
            calculateTotal();
        }
    } catch (error) {
        console.log('No hay evaluación previa para este proyecto');
    }
}

// ✅ EXPORTAR A PDF
async function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Calcular total si no está calculado
    calculateTotal();
    const totalScore = document.getElementById('total-score').textContent;
    
    // Obtener datos del formulario
    const form = document.getElementById('evaluation-form');
    const formData = new FormData(form);
    
    // Título
    doc.setFontSize(16);
    doc.text('EVALUACIÓN DE PROYECTO', 105, 15, { align: 'center' });
    
    // Info del proyecto
    doc.setFontSize(12);
    doc.text(`Proyecto: ${currentProjectForEvaluation.name}`, 20, 30);
    doc.text(`Categoría: ${currentProjectForEvaluation.category}`, 20, 40);
    doc.text(`Investigadores: ${currentProjectForEvaluation.researchers}`, 20, 50);
    
    // Criterios
    let y = 65;
    doc.setFontSize(11);
    
    doc.text('1. Pertinencia y Relevancia (20 pts)', 20, y);
    y += 7;
    doc.text(`   1.1: ${formData.get('eval1_1')} pts`, 25, y); y += 6;
    doc.text(`   1.2: ${formData.get('eval1_2')} pts`, 25, y); y += 6;
    doc.text(`   1.3: ${formData.get('eval1_3')} pts`, 25, y); y += 6;
    doc.text(`   1.4: ${formData.get('eval1_4')} pts`, 25, y); y += 6;
    doc.text(`   1.5: ${formData.get('eval1_5')} pts`, 25, y); y += 10;
    
    doc.text('2. Marco Teórico (15 pts)', 20, y); y += 7;
    doc.text(`   2.1: ${formData.get('eval2_1')} pts`, 25, y); y += 6;
    doc.text(`   2.2: ${formData.get('eval2_2')} pts`, 25, y); y += 6;
    doc.text(`   2.3: ${formData.get('eval2_3')} pts`, 25, y); y += 10;
    
    doc.text('3. Metodología (20 pts)', 20, y); y += 7;
    doc.text(`   3.1: ${formData.get('eval3_1')} pts`, 25, y); y += 6;
    doc.text(`   3.2: ${formData.get('eval3_2')} pts`, 25, y); y += 6;
    doc.text(`   3.3: ${formData.get('eval3_3')} pts`, 25, y); y += 6;
    doc.text(`   3.4: ${formData.get('eval3_4')} pts`, 25, y); y += 10;
    
    // Total
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`PUNTAJE TOTAL: ${totalScore} / 55 pts`, 20, y);
    
    // Guardar PDF
    doc.save(`Evaluacion_${currentProjectForEvaluation.name}_${Date.now()}.pdf`);
    alert('✅ PDF exportado exitosamente');
}

// ==================== BÚSQUEDA Y FILTROS ====================
function searchProjects() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const cards = document.querySelectorAll('.project-card');

    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
}

function filterByCategory(category) {
    const cards = document.querySelectorAll('.project-card');

    cards.forEach(card => {
        const cardCategory = card.querySelector('.project-category').textContent;
        if (category === 'todos' || cardCategory === category) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Sistema inicializado');
    console.log('🔗 API URL:', API_URL);
    
    // Vincular formulario de login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', login);
    }

    // Vincular formulario de nuevo proyecto
    const newProjectForm = document.getElementById('new-project-form');
    if (newProjectForm) {
        newProjectForm.addEventListener('submit', submitNewProject);
    }

    // Vincular formulario de evaluación
    const evaluationForm = document.getElementById('evaluation-form');
    if (evaluationForm) {
        evaluationForm.addEventListener('submit', submitEvaluation);
    }
});
