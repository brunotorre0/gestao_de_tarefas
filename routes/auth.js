const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/db');
const authenticate = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'a_sua_chave_secreta_segura';

router.post('/register', async (req, res) => {
    const { email, password, nome } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e password são obrigatórios.' });
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ error: 'Utilizador com este email já existe.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                nome,
            },
            select: { id: true, email: true, nome: true }
        });

        res.status(201).json({ message: 'Registo bem-sucedido!', user });

    } catch (error) {
        console.error('Erro no registo:', error);
        res.status(500).json({ error: 'Erro interno do servidor durante o registo.' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e password são obrigatórios.' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        
        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ 
            message: 'Login bem-sucedido!', 
            token,
            user: { id: user.id, email: user.email, nome: user.nome }
        });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor durante o login.' });
    }
});

router.get('/users', authenticate, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                nome: true,
            },
            orderBy: {
                id: 'asc',
            },
        });

        res.status(200).json(users);
    } catch (error) {
        console.error('Erro ao buscar utilizadores:', error);
        res.status(500).json({ error: 'Erro interno ao buscar os utilizadores.' });
    }
});

router.get('/users/:id', authenticate, async (req, res) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
        return res.status(400).json({ error: 'ID do utilizador inválido.' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                nome: true,
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'Utilizador não encontrado.' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('Erro ao buscar utilizador:', error);
        res.status(500).json({ error: 'Erro interno ao buscar o utilizador.' });
    }
});

module.exports = router;
