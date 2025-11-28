const express = require('express');
const router = express.Router();
const prisma = require('../src/lib/db');
const authenticate = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync('uploads')) {
            fs.mkdirSync('uploads');
        }
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

router.use(authenticate);

router.post('/', upload.single('file'), async (req, res) => {
    const creatorId = req.userId;
    const { taskId } = req.body;
    const file = req.file;

    if (!file || !taskId) {
        if (file) fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'Ficheiro e ID da tarefa são obrigatórios.' });
    }

    try {
        const taskIdInt = parseInt(taskId);

        const task = await prisma.task.findUnique({ 
            where: { id: taskIdInt, creatorId } 
        });

        if (!task) {
            fs.unlinkSync(file.path);
            return res.status(404).json({ error: 'Tarefa não encontrada ou não pertence a este utilizador.' });
        }

        const newAttachment = await prisma.attachment.create({
            data: {
                taskId: taskIdInt,
                fileName: file.originalname,
                url: `/uploads/${file.filename}`,
            },
        });

        res.status(201).json(newAttachment);
    } catch (error) {
        if (file) fs.unlinkSync(file.path);
        console.error('Erro ao anexar ficheiro:', error);
        res.status(500).json({ error: 'Erro interno ao processar o anexo.' });
    }
});

router.get('/:taskId', async (req, res) => {
    const creatorId = req.userId;
    const taskId = parseInt(req.params.taskId);

    if (isNaN(taskId)) {
        return res.status(400).json({ error: 'ID da tarefa inválido.' });
    }

    try {
        const task = await prisma.task.findUnique({
            where: { id: taskId, creatorId }
        });
        
        if (!task) {
            return res.status(404).json({ error: 'Tarefa não encontrada ou não pertence a este utilizador.' });
        }

        const attachments = await prisma.attachment.findMany({
            where: { taskId }
        });

        res.status(200).json(attachments);
    } catch (error) {
        console.error('Erro ao buscar anexos:', error);
        res.status(500).json({ error: 'Erro interno ao buscar anexos.' });
    }
});

router.delete('/:id', async (req, res) => {
    const attachmentId = parseInt(req.params.id);
    const userId = req.userId;

    if (isNaN(attachmentId)) {
        return res.status(400).json({ error: 'ID do anexo inválido.' });
    }

    try {
        const attachment = await prisma.attachment.findUnique({
            where: { id: attachmentId },
            include: { task: { select: { creatorId: true } } }
        });

        if (!attachment || attachment.task.creatorId !== userId) {
            return res.status(404).json({ error: 'Anexo não encontrado ou não tem permissão para apagar.' });
        }
        
        const filePath = path.join(__dirname, '..', attachment.url);
        
        fs.unlink(filePath, (err) => {
            if (err) console.error("Aviso: Falha ao apagar ficheiro local:", err);
        });

        await prisma.attachment.delete({ where: { id: attachmentId } });

        res.status(200).json({ message: 'Anexo apagado com sucesso.' });

    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Anexo não encontrado.' });
        }
        console.error('Erro ao apagar anexo:', error);
        res.status(500).json({ error: 'Erro interno ao apagar o anexo.' });
    }
});

module.exports = router;
