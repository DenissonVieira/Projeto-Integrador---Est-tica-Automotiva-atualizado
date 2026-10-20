-- =====================================================================
-- Reluz Estética Automotiva - Banco de dados (PostgreSQL)
-- Para MySQL: troque SERIAL por INT AUTO_INCREMENT e TIMESTAMPTZ por DATETIME
-- Para SQLite: troque SERIAL por INTEGER PRIMARY KEY AUTOINCREMENT
-- =====================================================================

-- ---------- USUÁRIOS DO SISTEMA (login do painel) ----------
CREATE TABLE users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(160) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,            -- NUNCA guardar senha pura
    role          VARCHAR(20)  NOT NULL DEFAULT 'operator'
                  CHECK (role IN ('admin','operator','finance')),
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    DATETIME NOT NULL DEFAULT NOW()
);

-- ---------- CLIENTES (página costumer.html) ----------
CREATE TABLE customers (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    cpf_cnpj    VARCHAR(18)  UNIQUE,
    phone       VARCHAR(20),
    email       VARCHAR(160),
    address     VARCHAR(255),
    notes       TEXT,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  DATETIME NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_customers_name ON customers (name);

-- ---------- VEÍCULOS (página vehicles.html) ----------
-- Um cliente tem vários veículos (1:N)
CREATE TABLE vehicles (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    customer_id  INT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    plate        VARCHAR(8) NOT NULL UNIQUE,        -- placa
    brand        VARCHAR(60) NOT NULL,
    model        VARCHAR(80) NOT NULL,
    year         SMALLINT,
    color        VARCHAR(30),
    notes        TEXT,
    created_at   DATETIME NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_vehicles_customer ON vehicles (customer_id);

-- ---------- TIPOS DE SERVIÇO (badges da tela services.html) ----------
CREATE TABLE service_types (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(40) NOT NULL UNIQUE,
    badge_class VARCHAR(20) NOT NULL DEFAULT 'info' -- primary | info | warning | success | purple
);

-- ---------- CATÁLOGO DE SERVIÇOS (página services.html) ----------
CREATE TABLE services (
    id               INT AUTO_INCREMENT KEY,
    name             VARCHAR(120) NOT NULL,
    description      VARCHAR(255),
    type_id          INT NOT NULL REFERENCES service_types(id),
    price            NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    duration_hours   NUMERIC(4,1) NOT NULL DEFAULT 1,   -- tempo estimado
    warranty_months  SMALLINT NOT NULL DEFAULT 0,       -- 0 = sem garantia ("-")
    active           BOOLEAN NOT NULL DEFAULT TRUE,     -- Ativo / Inativo
    created_at       DATETIME NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_services_type ON services (type_id);

-- ---------- ORDENS DE SERVIÇO (página service-order.html) ----------
CREATE TABLE service_orders (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    code          VARCHAR(20) NOT NULL UNIQUE,          -- ex.: OS-2026-0001
    customer_id   INT NOT NULL REFERENCES customers(id),
    vehicle_id    INT NOT NULL REFERENCES vehicles(id),
    created_by    INT REFERENCES users(id),
    status        VARCHAR(20) NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','done','cancelled')),
    discount      NUMERIC(10,2) NOT NULL DEFAULT 0,
    total         NUMERIC(10,2) NOT NULL DEFAULT 0,     -- recalculado a partir dos itens
    notes         TEXT,
    opened_at     DATETIME NOT NULL DEFAULT NOW(),
    closed_at     DATETIME
);
CREATE INDEX idx_os_customer ON service_orders (customer_id);
CREATE INDEX idx_os_status   ON service_orders (status);

-- ---------- ITENS DA OS = o "Vínculo" entre OS e serviço ----------
-- Esta tabela alimenta o modal "Vínculos de OS" do services.html
CREATE TABLE service_order_items (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    order_id          INT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    service_id        INT NOT NULL REFERENCES services(id),
    unit_price        NUMERIC(10,2) NOT NULL,           -- preço NA HORA da venda (histórico)
    quantity          SMALLINT NOT NULL DEFAULT 1,
    warranty_months   SMALLINT NOT NULL DEFAULT 0,      -- copia do catálogo no momento
    warranty_until    DATE                              -- data final da garantia
);
CREATE INDEX idx_items_order   ON service_order_items (order_id);
CREATE INDEX idx_items_service ON service_order_items (service_id);

-- ---------- AGENDA (página schedule.html / FullCalendar) ----------
CREATE TABLE appointments (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    customer_id  INT REFERENCES customers(id),
    vehicle_id   INT REFERENCES vehicles(id),
    order_id     INT REFERENCES service_orders(id),
    title        VARCHAR(160) NOT NULL,
    start_at     DATETIME NOT NULL,
    end_at       DATETIME,
    status       VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled','confirmed','done','cancelled')),
    category     VARCHAR(20) DEFAULT 'work'             -- vira a classe fc-cat-*
);
CREATE INDEX idx_appt_start ON appointments (start_at);

-- ---------- FINANCEIRO (página finance.html) ----------
CREATE TABLE transactions (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    order_id       INT REFERENCES service_orders(id),   -- NULL em despesas avulsas
    kind           VARCHAR(10) NOT NULL CHECK (kind IN ('income','expense')),
    description    VARCHAR(200) NOT NULL,
    amount         NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    method         VARCHAR(20) CHECK (method IN ('cash','pix','debit','credit','transfer')),
    due_date       DATE,
    paid_at        DATETIME,                         -- NULL = pendente
    created_at     DATETIME NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tx_paid ON transactions (paid_at);

-- =====================================================================
-- DADOS INICIAIS (os mesmos 15 serviços do seu services.html)
-- =====================================================================
INSERT INTO service_types (name, badge_class) VALUES
 ('Plotagem','purple'), ('Estética','primary'), ('Manutenção','info'),
 ('Revisão','warning'), ('Garantia','success');

INSERT INTO services (name, description, type_id, price, duration_hours, warranty_months, active) VALUES
('Envelopamento PPF Completo','Proteção de pintura transparente de alta durabilidade',(SELECT id FROM service_types WHERE name='Plotagem'),4500.00,16,36,TRUE),
('Polimento Técnico & Vitrificação','Correção de pintura e aplicação de proteção cerâmica',(SELECT id FROM service_types WHERE name='Estética'),1200.00,8,12,TRUE),
('Higienização Detalhada Interna','Limpeza de bancos, teto, carpetes e aplicação de ozônio',(SELECT id FROM service_types WHERE name='Manutenção'),350.00,4,3,TRUE),
('Revisão de Vitrificação','Lavagem detalhada, descontaminação e reativação de brilho',(SELECT id FROM service_types WHERE name='Revisão'),200.00,2,0,TRUE),
('Reparo em Garantia de Película','Substituição de PPF/Insulfilm com avaria coberta',(SELECT id FROM service_types WHERE name='Garantia'),0.00,3,0,FALSE),
('Aplicação de Insulfilm Alta Performance','Película com controle térmico UV/IR',(SELECT id FROM service_types WHERE name='Plotagem'),650.00,3,24,TRUE),
('Lavagem Comercial & Cera','Lavagem rápida externa e aspiração interna simples',(SELECT id FROM service_types WHERE name='Manutenção'),90.00,1,0,TRUE),
('Restauração de Faróis','Lixamento técnico e aplicação de verniz UV para lentes amareladas',(SELECT id FROM service_types WHERE name='Estética'),180.00,2,6,TRUE),
('Higienização de Bancos em Couro','Limpeza profunda com hidratação de matéria-prima sintética e natural',(SELECT id FROM service_types WHERE name='Manutenção'),280.00,3,3,TRUE),
('Envelopamento Teto Black Piano','Aplicação de vinil premium no teto simulando teto solar',(SELECT id FROM service_types WHERE name='Plotagem'),500.00,4,12,TRUE),
('Vitrificação para Para-brisas','Proteção repelente contra água e chuva rápida',(SELECT id FROM service_types WHERE name='Estética'),150.00,1,6,TRUE),
('Limpeza Técnica de Motor','Remoção de óleos com produtos dielétricos e acabamento',(SELECT id FROM service_types WHERE name='Manutenção'),220.00,2,0,TRUE),
('Remoção de PPF/Insulfilm Antigo','Remoção cuidadosa de películas e limpeza de cola',(SELECT id FROM service_types WHERE name='Revisão'),160.00,2,0,TRUE),
('Garantia Polimento Cerâmico','Inspeção e manutenção corretiva sob termo de garantia',(SELECT id FROM service_types WHERE name='Garantia'),0.00,2,0,TRUE),
('Polimento de Rodas e Pintura','Proteção e brilho específico para superfícies de liga leve',(SELECT id FROM service_types WHERE name='Estética'),300.00,3,6,TRUE);

-- =====================================================================
-- CONSULTA QUE ALIMENTA O MODAL "VÍNCULOS DE OS" (substitui os dados fixos do JS)
-- =====================================================================
-- SELECT so.code, c.name AS customer, so.opened_at::date AS date, so.status
-- FROM service_order_items i
-- JOIN service_orders so ON so.id = i.order_id
-- JOIN customers c       ON c.id  = so.customer_id
-- WHERE i.service_id = :service_id
-- ORDER BY so.opened_at DESC;

