const express = require('express');
const router = express.Router();
const prisma = require('../src/lib/db');
const authenticate = require('../middleware/auth');

router.use(authenticate);

router.post('/', async (req, res) => {
    const userId = req.userId;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'O nome da categoria é obrigatório.' });
    }

    try {
        const newCategory = await prisma.category.create({
            data: {
                name,
                userId,
            },
        });
        res.status(201).json(newCategory);
    } catch (error) {
        console.error('Erro ao criar categoria:', error);
        res.status(500).json({ error: 'Erro interno ao criar a categoria.' });
    }
});

router.get('/', async (req, res) => {
    const userId = req.userId;

    try {
        const categories = await prisma.category.findMany({
            where: { userId },
            orderBy: { name: 'asc' },
            include: { tasks: { select: { id: true, title: true } } }
        });
        res.status(200).json(categories);
    } catch (error) {
        console.error('Erro ao buscar categorias:', error);
        res.status(500).json({ error: 'Erro interno ao buscar as categorias.' });
    }
});

router.put('/:id', async (req, res) => {
    const categoryId = parseInt(req.params.id);
    const userId = req.userId;
    const { name } = req.body;

    if (isNaN(categoryId) || !name) {
        return res.status(400).json({ error: 'ID da categoria ou nome inválido.' });
    }

    try {
        const category = await prisma.category.findFirst({
            where: {
                id: categoryId,
                userId,
            },
        });

        if (!category) {
            return res.status(404).json({ error: 'Categoria não encontrada ou não pertence a este utilizador.' });
        }

        const updatedCategory = await prisma.category.update({
            where: {
                id: categoryId,
            },
            data: { name },
        });
        res.status(200).json(updatedCategory);

    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Categoria não encontrada.' });
        }
        console.error('Erro ao atualizar categoria:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar a categoria.' });
    }
});

router.delete('/:id', async (req, res) => {
    const categoryId = parseInt(req.params.id);
    const userId = req.userId;

    if (isNaN(categoryId)) {
        return res.status(400).json({ error: 'ID da categoria inválido.' });
    }

    try {
        const category = await prisma.category.findFirst({
            where: {
                id: categoryId,
                userId,
            },
        });

        if (!category) {
            return res.status(404).json({ error: 'Categoria não encontrada ou não pertence a este utilizador.' });
        }

        const deletedCategory = await prisma.category.delete({
            where: {
                id: categoryId,
            },
        });
        res.status(200).json({ message: 'Categoria apagada com sucesso!', deletedCategory });

    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Categoria não encontrada.' });
        }
        console.error('Erro ao apagar categoria:', error);
        res.status(500).json({ error: 'Erro interno ao apagar a categoria.' });
    }
});

module.exports = router;
