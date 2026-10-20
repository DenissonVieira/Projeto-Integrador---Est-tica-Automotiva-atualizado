import express, {} from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
const app = express();
app.use(cors());
app.use(express.json());
// Inicializa SQLite
const db = new sqlite3.Database('./clinica.sqlite', (err) => {
    if (err)
        console.error('Erro ao conectar ao banco:', err.message);
    else
        console.log('Conectado ao banco de dados SQLite.');
});
// Setup do banco
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
    db.get("SELECT COUNT(*) AS count FROM pacientes", (err, row) => {
        if (row.count === 0) {
            db.run(`INSERT INTO pacientes (nome) VALUES ('Ana'), ('Carlos'), ('Beatriz')`);
            db.run(`INSERT INTO sintomas (descricao) VALUES ('Febre'), ('Dor de cabeça'), ('Tosse')`);
            db.run(`INSERT INTO consultas (paciente_id, data_consulta) VALUES 
                (1, '2026-04-10'), (2, '2026-04-11'), (3, '2026-04-12'), (1, '2026-04-15')`);
            db.run(`INSERT INTO consulta_sintoma (consulta_id, sintoma_id) VALUES 
                (1,1),(1,2),(2,3),(3,1),(4,1),(4,3)`);
        }
    });
});
// ROTAS
app.get('/api/etapa5', (req, res) => {
    db.all("SELECT * FROM pacientes", [], (err, rows) => {
        res.json({ pacientes: rows });
    });
});
app.post('/api/atendimento', (req, res) => {
    const { nome, sintoma } = req.body;
    if (!nome || !sintoma) {
        return res.status(400).json({ error: "Nome e sintoma são obrigatórios!" });
    }
    const dataAtual = new Date().toISOString().split('T')[0];
    db.run(`INSERT INTO pacientes (nome) VALUES (?)`, [nome], function (err) {
        if (err)
            return res.status(500).json({ error: err.message });
        const paciente_id = this.lastID;
        db.run(`INSERT INTO consultas (paciente_id, data_consulta) VALUES (?, ?)`, [paciente_id, dataAtual], function (err) {
            if (err)
                return res.status(500).json({ error: err.message });
            const consulta_id = this.lastID;
            db.get(`SELECT id FROM sintomas WHERE descricao = ?`, [sintoma], (err, row) => {
                if (row) {
                    vincular(consulta_id, row.id);
                }
                else {
                    db.run(`INSERT INTO sintomas (descricao) VALUES (?)`, [sintoma], function (err) {
                        vincular(consulta_id, this.lastID);
                    });
                }
            });
            function vincular(c_id, s_id) {
                db.run(`INSERT INTO consulta_sintoma (consulta_id, sintoma_id) VALUES (?, ?)`, [c_id, s_id], (err) => {
                    if (err)
                        return res.status(500).json({ error: err.message });
                    res.json({
                        message: "Atendimento registrado com sucesso!",
                        paciente: nome,
                        sintoma: sintoma
                    });
                });
            }
        });
    });
});
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
//# sourceMappingURL=server.js.map