import express, { Request, Response } from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import jwt from "jsonwebtoken";

console.log("🚀 Iniciando servidor...");

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Inicializa SQLite
const db = new sqlite3.Database('./clinica.sqlite', (err: Error | null) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
    } else {
        console.log('✅ Banco de dados conectado.');
    }
});

const SECRET = "chave-super-secreta"; // use variável de ambiente em produção

// Rota de login
app.post('/login', (req: Request, res: Response) => {
    const { usuario, senha } = req.body;
    if (usuario === "admin" && senha === "1234") {
        const token = jwt.sign({ usuario }, SECRET, { expiresIn: "1h" });
        res.json({ token });
    } else {
        res.status(401).json({ erro: "Credenciais inválidas" });
    }
});

// Middleware para proteger rotas
function autenticar(req: Request, res: Response, next: Function) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ erro: "Token não fornecido" });

    const token = authHeader.split(" ")[1];
    jwt.verify(token, SECRET, (err) => {
        if (err) return res.status(403).json({ erro: "Token inválido" });
        next();
    });
}


// 🔹 Criação das tabelas e dados iniciais
db.serialize(() => {

    db.run(`CREATE TABLE IF NOT EXISTS pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS consultas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER,
        data_consulta TEXT,
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sintomas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descricao TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS consulta_sintoma (
        consulta_id INTEGER,
        sintoma_id INTEGER,
        FOREIGN KEY (consulta_id) REFERENCES consultas(id),
        FOREIGN KEY (sintoma_id) REFERENCES sintomas(id),
        PRIMARY KEY (consulta_id, sintoma_id)
    )`);

    // 🔹 Inserção inicial segura
    db.get("SELECT COUNT(*) AS count FROM pacientes", (err: Error | null, row: any) => {
        if (err) {
            console.error("Erro ao verificar dados iniciais:", err.message);
            return;
        }

        if (row && row.count === 0) {
            console.log("📦 Inserindo dados iniciais...");

            db.run(`INSERT INTO pacientes (nome) VALUES ('Ana'), ('Carlos'), ('Beatriz')`);
            db.run(`INSERT INTO sintomas (descricao) VALUES ('Febre'), ('Dor de cabeça'), ('Tosse')`);
            db.run(`INSERT INTO consultas (paciente_id, data_consulta) VALUES 
                (1, '2026-04-10'), (2, '2026-04-11'), (3, '2026-04-12'), (1, '2026-04-15')`);
            db.run(`INSERT INTO consulta_sintoma (consulta_id, sintoma_id) VALUES 
                (1,1),(1,2),(2,3),(3,1),(4,1),(4,3)`);
        }
    });
});

// 🔹 Teste rápido da API
app.get('/', (req: Request, res: Response) => {
    res.send('✅ API funcionando!');
});

// 🔹 Etapa 5
app.get('/api/etapa5', (req: Request, res: Response) => {
    db.all("SELECT * FROM pacientes", [], (err: Error | null, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ pacientes: rows });
    });
});

// 🔹 Etapa 6 - JOIN básico
app.get('/api/etapa6', (req: Request, res: Response) => {
    const sql = `
        SELECT p.nome, c.data_consulta 
        FROM pacientes p 
        JOIN consultas c ON p.id = c.paciente_id
    `;
    db.all(sql, [], (err: Error | null, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 🔹 Etapa 7 - JOIN completo
app.get('/api/etapa7', (req: Request, res: Response) => {
    const sql = `
        SELECT p.nome, s.descricao AS sintoma 
        FROM pacientes p
        JOIN consultas c ON p.id = c.paciente_id
        JOIN consulta_sintoma cs ON c.id = cs.consulta_id
        JOIN sintomas s ON cs.sintoma_id = s.id
    `;
    db.all(sql, [], (err: Error | null, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 🔹 Etapa 8 - Filtro
app.get('/api/etapa8', (req: Request, res: Response) => {
    const sql = `
        SELECT p.nome 
        FROM pacientes p
        JOIN consultas c ON p.id = c.paciente_id
        JOIN consulta_sintoma cs ON c.id = cs.consulta_id
        JOIN sintomas s ON cs.sintoma_id = s.id
        WHERE s.descricao = 'Febre'
    `;
    db.all(sql, [], (err: Error | null, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 🔹 Etapa 9 - Agregação
app.get('/api/etapa9', (req: Request, res: Response) => {
    const sql = `
        SELECT p.nome, COUNT(c.id) as total_consultas 
        FROM pacientes p
        LEFT JOIN consultas c ON p.id = c.paciente_id
        GROUP BY p.id
    `;
    db.all(sql, [], (err: Error | null, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 🔹 Etapa 10 - Desafio
app.get('/api/etapa10', (req: Request, res: Response) => {
    const sql = `
        SELECT s.descricao, COUNT(cs.sintoma_id) as frequencia
        FROM consulta_sintoma cs
        JOIN sintomas s ON cs.sintoma_id = s.id
        GROUP BY cs.sintoma_id
        ORDER BY frequencia DESC
        LIMIT 1
    `;
    db.get(sql, [], (err: Error | null, row: any) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

// 🔹 POST Atendimento
interface AtendimentoBody {
    nome: string;
    sintoma: string;
}

app.post('/api/atendimento', (req: Request<{}, {}, AtendimentoBody>, res: Response) => {
    const { nome, sintoma } = req.body;

if (
    typeof nome !== 'string' ||
    typeof sintoma !== 'string' ||
    nome.trim() === '' ||
    sintoma.trim() === '' ||
    !/^[A-Za-zÀ-ÿ\s]+$/.test(nome)
) {
    return res.status(400).json({
        error: "Nome inválido. Use apenas letras."
    });
}

// Atualizar paciente
app.put('/pacientes/:id', autenticar, (req: Request, res: Response) => {
    const { id } = req.params;
    const { nome, idade } = req.body;
    db.run("UPDATE pacientes SET nome = ?, idade = ? WHERE id = ?", [nome, idade, id], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ atualizado: this.changes });
    });
});

// Deletar paciente
app.delete('/pacientes/:id', autenticar, (req: Request, res: Response) => {
    const { id } = req.params;
    db.run("DELETE FROM pacientes WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ deletado: this.changes });
    });
});

    const dataAtual = new Date().toISOString().split('T')[0];

    // 🔹 Busca paciente existente
    db.get(`SELECT id FROM pacientes WHERE nome = ?`, [nome], (err: Error | null, row: any) => {

        if (err) return res.status(500).json({ error: err.message });

        const inserirConsulta = (paciente_id: number) => {

            db.run(`INSERT INTO consultas (paciente_id, data_consulta) VALUES (?, ?)`,
                [paciente_id, dataAtual],
                function (err: Error | null) {

                    if (err) return res.status(500).json({ error: err.message });

                    const consulta_id = this.lastID;

                    db.get(`SELECT id FROM sintomas WHERE descricao = ?`, [sintoma],
                        (err: Error | null, row: any) => {

                            if (row) {
                                vincular(consulta_id, row.id);
                            } else {
                                db.run(`INSERT INTO sintomas (descricao) VALUES (?)`, [sintoma],
                                    function () {
                                        vincular(consulta_id, this.lastID);
                                    });
                            }
                        });

                    function vincular(c_id: number, s_id: number) {
                        db.run(`INSERT INTO consulta_sintoma (consulta_id, sintoma_id) VALUES (?, ?)`,
                            [c_id, s_id],
                            (err: Error | null) => {

                                if (err) return res.status(500).json({ error: err.message });

                                res.json({
                                    message: "Atendimento registrado com sucesso!",
                                    paciente: nome,
                                    sintoma: sintoma
                                });
                            });
                    }
                });
        };

        if (row) {
            inserirConsulta(row.id);
        } else {
            db.run(`INSERT INTO pacientes (nome) VALUES (?)`, [nome], function (err: Error | null) {
                if (err) return res.status(500).json({ error: err.message });
                inserirConsulta(this.lastID);
            });
        }
    });
});

// 🔹 Porta
const PORT: number = 3000;

app.listen(PORT, () => {
    console.log(`🔥 Servidor rodando em http://localhost:${PORT}`);
});

// 🔹 Captura erros silenciosos
process.on('uncaughtException', (err) => {
    console.error('❌ Erro não tratado:', err);
});