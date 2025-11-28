const express = require('express');
const router = express.Router();
const prisma = require('../src/lib/db');
const authenticate = require('../middleware/auth');

router.use(authenticate);

router.post('/', async (req, res) => {
    const creatorId = req.userId;
    const { taskId, targetUserEmail } = req.body;

    if (!taskId || !targetUserEmail) {
        return res.status(400).json({ error: 'ID da tarefa e email do utilizador alvo são obrigatórios.' });
    }

    try {
        const task = await prisma.task.findUnique({
            where: { id: taskId, creatorId: creatorId }
        });

        if (!task) {
            return res.status(404).json({ error: 'Tarefa não encontrada ou não pertence a este utilizador.' });
        }

        const targetUser = await prisma.user.findUnique({
            where: { email: targetUserEmail }
        });

        if (!targetUser) {
            return res.status(404).json({ error: 'Utilizador alvo não encontrado.' });
        }
        
        if (targetUser.id === creatorId) {
            return res.status(400).json({ error: 'Não pode partilhar uma tarefa consigo mesmo.' });
        }

        const sharedTask = await prisma.sharedTask.create({
            data: {
                taskId,
                userId: targetUser.id,
            },
            include: { 
                task: { select: { title: true } }, 
                user: { select: { nome: true, email: true } }
            }
        });

        res.status(201).json({ 
            message: `Tarefa '${task.title}' partilhada com ${targetUser.nome || targetUser.email}.`,
            sharedTask 
        });

    } catch (error) {
        if (error.code === 'P2002') {
             return res.status(409).json({ error: 'Esta tarefa já foi partilhada com este utilizador.' });
        }
        console.error('Erro ao partilhar tarefa:', error);
        res.status(500).json({ error: 'Erro interno ao partilhar a tarefa.' });
    }
});

router.get('/received', async (req, res) => {
    const userId = req.userId;

    try {
        const receivedShares = await prisma.sharedTask.findMany({
            where: { userId },
            include: { 
                task: { 
                    include: { 
                        creator: { select: { nome: true, email: true } } 
                    } 
                } 
            },
            orderBy: { task: { createdAt: 'desc' } }
        });
        
        const formatDate = (date) => {
            if (!date) return null;
            const d = new Date(date);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${day}-${month}-${year} ${hours}:${minutes}`;
        };

        const tasks = receivedShares.map(share => {
            const task = share.task;
            return {
                ...task,
                sharedBy: task.creator,
                dueDate: formatDate(task.dueDate),
                createdAt: formatDate(task.createdAt),
                updatedAt: formatDate(task.updatedAt),
            };
        });
        
        res.status(200).json(tasks);

    } catch (error) {
        console.error('Erro ao buscar tarefas partilhadas:', error);
        res.status(500).json({ error: 'Erro interno ao buscar tarefas partilhadas.' });
    }
});

router.delete('/', async (req, res) => {
    const creatorId = req.userId;
    const { taskId, targetUserId } = req.body;

    if (!taskId || !targetUserId) {
        return res.status(400).json({ error: 'ID da tarefa e ID do utilizador alvo são obrigatórios.' });
    }

    try {
        const task = await prisma.task.findUnique({
            where: { id: taskId, creatorId: creatorId }
        });

        if (!task) {
            return res.status(404).json({ error: 'Tarefa não encontrada ou não pertence a este utilizador.' });
        }
        
        const deletedShare = await prisma.sharedTask.delete({
            where: {
                taskId_userId: { 
                    taskId,
                    userId: targetUserId,
                }
            }
        });

        res.status(200).json({ 
            message: `Partilha da tarefa '${task.title}' com o utilizador ${targetUserId} removida.`,
            deletedShare
        });

    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Partilha não encontrada.' });
        }
        console.error('Erro ao remover partilha:', error);
        res.status(500).json({ error: 'Erro interno ao remover a partilha.' });
    }
});

module.exports = router;
