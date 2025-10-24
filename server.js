require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// ✅ Crear carpeta uploads si no existe
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// ✅ Configuración de multer para subir archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF'));
        }
    }
});

// ✅ Configuración de PostgreSQL con variables de entorno
const pool = new Pool({
    user: process.env.DATABASE_USER || 'adminupla',
    host: process.env.DATABASE_HOST || 'upla-innovacion-db.postgres.database.azure.com',
    database: process.env.DATABASE_NAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'UplaInnovacion2025!',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    ssl: {
        rejectUnauthorized: false
    }
});

// ✅ Verificar conexión a la base de datos
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error al conectar a la base de datos:', err.stack);
    } else {
        console.log('✅ Conectado a Azure PostgreSQL');
        release();
    }
});

// ==================== RUTAS API ====================

// ✅ Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email y contraseña son requeridos' });
        }
        
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.json({ success: false, message: 'Usuario no encontrado' });
        }

        const user = result.rows[0];
        
        // Si NO tiene password en la base de datos, usar password plana temporalmente
        if (!user.password || user.password === null) {
            if (password === '123456') {
                return res.json({ 
                    success: true, 
                    user: { 
                        id: user.id, 
                        email: user.email 
                    } 
                });
            } else {
                return res.json({ success: false, message: 'Contraseña incorrecta' });
            }
        } else {
            // Verificar contraseña con bcrypt
            const isValidPassword = await bcrypt.compare(password, user.password);
            
            if (!isValidPassword) {
                return res.json({ success: false, message: 'Contraseña incorrecta' });
            }

            return res.json({ 
                success: true, 
                user: { 
                    id: user.id, 
                    email: user.email 
                } 
            });
        }
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// ✅ Obtener todos los proyectos con estado de evaluación
app.get('/api/projects', async (req, res) => {
    try {
        const query = `
            SELECT 
                p.*,
                e.total_score,
                CASE WHEN e.id IS NOT NULL THEN true ELSE false END as has_evaluation
            FROM projects p
            LEFT JOIN evaluations e ON p.id = e.project_id
            ORDER BY p.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener proyectos:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Obtener UN proyecto por ID con estado de evaluación
app.get('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                p.*,
                e.total_score,
                CASE WHEN e.id IS NOT NULL THEN true ELSE false END as has_evaluation
            FROM projects p
            LEFT JOIN evaluations e ON p.id = e.project_id
            WHERE p.id = $1
        `;
        const result = await pool.query(query, [id]);
        
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Proyecto no encontrado' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Crear nuevo proyecto
app.post('/api/projects', upload.single('file'), async (req, res) => {
    try {
        const {
            category, name, type, researchers, study_program,
            research_line, contact_email, general_info,
            problem_description, theoretical_framework, project_summary, user_id
        } = req.body;

        const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const query = `
            INSERT INTO projects (
                category, name, type, researchers, study_program,
                research_line, contact_email, general_info,
                problem_description, theoretical_framework,
                project_summary, file_url, user_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `;

        const result = await pool.query(query, [
            category, name, type, researchers, study_program,
            research_line, contact_email, general_info,
            problem_description, theoretical_framework,
            project_summary, fileUrl, user_id
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al crear proyecto:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Eliminar proyecto
app.delete('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length > 0) {
            res.json({ success: true, message: 'Proyecto eliminado' });
        } else {
            res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
        }
    } catch (error) {
        console.error('Error al eliminar proyecto:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Guardar o actualizar evaluación
app.post('/api/evaluations', async (req, res) => {
    try {
        const {
            project_id, 
            eval1_1, eval1_2, eval1_3, eval1_4, eval1_5, obs1,
            eval2_1, eval2_2, eval2_3, obs2,
            eval3_1, eval3_2, eval3_3, eval3_4, obs3,
            final_recommendations, total_score, evaluator_id
        } = req.body;

        const query = `
            INSERT INTO evaluations (
                project_id, 
                eval1_1, eval1_2, eval1_3, eval1_4, eval1_5, obs1,
                eval2_1, eval2_2, eval2_3, obs2,
                eval3_1, eval3_2, eval3_3, eval3_4, obs3,
                final_recommendations, total_score, evaluator_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            ON CONFLICT (project_id) 
            DO UPDATE SET
                eval1_1=$2, eval1_2=$3, eval1_3=$4, eval1_4=$5, eval1_5=$6, obs1=$7,
                eval2_1=$8, eval2_2=$9, eval2_3=$10, obs2=$11,
                eval3_1=$12, eval3_2=$13, eval3_3=$14, eval3_4=$15, obs3=$16,
                final_recommendations=$17, total_score=$18, evaluator_id=$19, updated_at=NOW()
            RETURNING *
        `;

        const result = await pool.query(query, [
            project_id,
            eval1_1, eval1_2, eval1_3, eval1_4, eval1_5, obs1,
            eval2_1, eval2_2, eval2_3, obs2,
            eval3_1, eval3_2, eval3_3, eval3_4, obs3,
            final_recommendations, total_score, evaluator_id
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al guardar evaluación:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Obtener evaluación por project_id
app.get('/api/evaluations/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const result = await pool.query(
            'SELECT * FROM evaluations WHERE project_id = $1',
            [projectId]
        );
        
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Evaluación no encontrada' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Ruta de health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Servidor funcionando correctamente' });
});

// ✅ Puerto dinámico para producción
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor backend corriendo en puerto ${PORT}`);
    console.log(`📍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

