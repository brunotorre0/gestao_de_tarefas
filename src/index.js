const express = require('express');
const prisma = require('./lib/db');
const path = require('path');
require('dotenv').config();

const authRoutes = require('../routes/auth');
const taskRoutes = require('../routes/tasks');
const categoryRoutes = require('../routes/categories');
const sharingRoutes = require('../routes/sharing');
const attachmentRoutes = require('../routes/attachments');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/categories', categoryRoutes);
app.use('/sharing', sharingRoutes);
app.use('/attachments', attachmentRoutes);

app.get('/', (req, res) => {
    res.send('Servidor de Gestão de Tarefas a funcionar! 🚀');
});

app.listen(PORT, () => {
    console.log(`Servidor a correr em http://localhost:${PORT}`);
    prisma.$connect()
        .then(() => console.log("✅ Ligação à Base de Dados estabelecida."))
        .catch(err => console.error("❌ Erro de Ligação à Base de Dados:", err));
});
