const express = require('express');
const router = express.Router();
const prisma = require('../src/lib/db');
const authenticate = require('../middleware/auth');

router.use(authenticate);

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

const formatTask = (task) => {
    if (!task) return task;
    return {
        ...task,
        dueDate: formatDate(task.dueDate),
        createdAt: formatDate(task.createdAt),
        updatedAt: formatDate(task.updatedAt),
    };
};

router.post('/', async (req, res) => {
    const creatorId = req.userId;
    const { title, description, dueDate, priority, categoryId } = req.body;

    if (!title) {
        return res.status(400).json({ error: 'O título da tarefa é obrigatório.' });
    }

    try {
        const parseDate = (dateString) => {
            if (!dateString) return null;
            const ddmmyyyyPattern = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/;
            const match = dateString.match(ddmmyyyyPattern);
            
            if (match) {
                const [, day, month, year, hour, minute, second] = match;
                return new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hour),
                    parseInt(minute),
                    second ? parseInt(second) : 0
                );
            }
            return new Date(dateString);
        };

        const newTask = await prisma.task.create({
            data: {
                title,
                description,
                dueDate: dueDate ? parseDate(dueDate) : null,
                priority: priority || 'Normal',
                creatorId,
                categoryId: categoryId || null,
            },
        });
        const formattedTask = formatTask(newTask);
        res.status(201).json(formattedTask);
    } catch (error) {
        console.error('Erro ao criar tarefa:', error);
        res.status(500).json({ error: 'Erro interno ao criar a tarefa.' });
    }
});

router.get('/', async (req, res) => {
    const creatorId = req.userId;

    try {
        const tasks = await prisma.task.findMany({
            where: { creatorId },
            orderBy: { createdAt: 'desc' },
            include: { 
                category: true,
                attachments: true,
                sharedWith: { include: { user: { select: { id: true, nome: true, email: true } } } }
            }
        });
        const formattedTasks = tasks.map(task => formatTask(task));
        res.status(200).json(formattedTasks);
    } catch (error) {
        console.error('Erro ao buscar tarefas:', error);
        res.status(500).json({ error: 'Erro interno ao buscar as tarefas.' });
    }
});

router.get('/:id', async (req, res) => {
    const taskId = parseInt(req.params.id);
    const creatorId = req.userId;

    if (isNaN(taskId)) {
        return res.status(400).json({ error: 'ID da tarefa inválido.' });
    }

    try {
        const task = await prisma.task.findFirst({
            where: {
                id: taskId,
                creatorId,
            },
            include: { category: true, attachments: true, sharedWith: { include: { user: { select: { id: true, nome: true, email: true } } } } }
        });

        if (!task) {
            return res.status(404).json({ error: 'Tarefa não encontrada.' });
        }
        const formattedTask = formatTask(task);
        res.status(200).json(formattedTask);

    } catch (error) {
        console.error('Erro ao buscar tarefa por ID:', error);
        res.status(500).json({ error: 'Erro interno ao buscar a tarefa.' });
    }
});

router.put('/:id', async (req, res) => {
    const taskId = parseInt(req.params.id);
    const creatorId = req.userId;
    const updateData = req.body;

    if (isNaN(taskId)) {
        return res.status(400).json({ error: 'ID da tarefa inválido.' });
    }

    try {
        const task = await prisma.task.findFirst({
            where: {
                id: taskId,
                creatorId,
            },
        });

        if (!task) {
            return res.status(404).json({ error: 'Tarefa não encontrada ou não pertence a este utilizador.' });
        }

        const updatedTask = await prisma.task.update({
            where: {
                id: taskId,
            },
            data: {
                ...updateData,
                dueDate: updateData.dueDate ? (() => {
                    const dateString = updateData.dueDate;
                    const ddmmyyyyPattern = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/;
                    const match = dateString.match(ddmmyyyyPattern);
                    
                    if (match) {
                        const [, day, month, year, hour, minute, second] = match;
                        return new Date(
                            parseInt(year),
                            parseInt(month) - 1,
                            parseInt(day),
                            parseInt(hour),
                            parseInt(minute),
                            second ? parseInt(second) : 0
                        );
                    }
                    return new Date(dateString);
                })() : undefined,
            },
        });
        const formattedTask = formatTask(updatedTask);
        res.status(200).json(formattedTask);

    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Tarefa não encontrada.' });
        }
        console.error('Erro ao atualizar tarefa:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar a tarefa.' });
    }
});

router.delete('/:id', async (req, res) => {
    const taskId = parseInt(req.params.id);
    const creatorId = req.userId;

    if (isNaN(taskId)) {
        return res.status(400).json({ error: 'ID da tarefa inválido.' });
    }

    try {
        const task = await prisma.task.findFirst({
            where: {
                id: taskId,
                creatorId,
            },
        });

        if (!task) {
            return res.status(404).json({ error: 'Tarefa não encontrada ou não pertence a este utilizador.' });
        }

        const deletedTask = await prisma.task.delete({
            where: {
                id: taskId,
            },
        });

        const formattedDeletedTask = formatTask(deletedTask);
        res.status(200).json({ message: 'Tarefa apagada com sucesso!', deletedTask: formattedDeletedTask });

    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Tarefa não encontrada.' });
        }
        console.error('Erro ao apagar tarefa:', error);
        res.status(500).json({ error: 'Erro interno ao apagar a tarefa.' });
    }
});

module.exports = router;
