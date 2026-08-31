-- ============================================================
-- schema.sql
-- Base de datos MySQL para el Gestor de Clientes.
-- Ejecutar completo una sola vez (por ejemplo: mysql -u root -p < schema.sql)
-- ============================================================

CREATE DATABASE IF NOT EXISTS gestor_clientes CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci;
USE gestor_clientes;

-- Tabla "Datos del Cliente"
CREATE TABLE IF NOT EXISTS clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  sexo ENUM('M', 'F') NOT NULL,
  dni VARCHAR(20) DEFAULT '',
  cuil VARCHAR(20) DEFAULT '',
  fecha_nacimiento DATE NULL,
  telefono VARCHAR(30) DEFAULT '',
  mail VARCHAR(150) DEFAULT '',
  fecha_alta DATE NULL,
  estado_civil VARCHAR(40) DEFAULT '',
  profesion VARCHAR(100) DEFAULT '',
  direccion VARCHAR(200) DEFAULT '',
  referente VARCHAR(150) DEFAULT '',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tabla "Copropietario", asociada a un cliente (máx. 3 por cliente, ver trigger abajo)
CREATE TABLE IF NOT EXISTS copropietarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  dni VARCHAR(20) DEFAULT '',
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Trigger: impide insertar un 4to copropietario para el mismo cliente
DELIMITER $$
CREATE TRIGGER trg_max_copropietarios
BEFORE INSERT ON copropietarios
FOR EACH ROW
BEGIN
  DECLARE cantidad INT;
  SELECT COUNT(*) INTO cantidad FROM copropietarios WHERE cliente_id = NEW.cliente_id;
  IF cantidad >= 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un cliente no puede tener más de 3 copropietarios';
  END IF;
END$$
DELIMITER ;

-- ============================================================
-- Datos semilla: nombres, teléfonos y fechas reales de CLIENTES.xlsx.
-- El resto de los campos (DNI, CUIL, mail, etc.) no estaban en el Excel
-- y quedan vacíos hasta completarse desde el formulario de edición.
-- ============================================================
INSERT INTO clientes (nombre, sexo, telefono, fecha_alta) VALUES
('María Isabel Pisoni', 'F', '3515446543', '2025-11-12'),
('Paola Gabriela Cañarte', 'F', '3512062422', '2025-11-13'),
('Federico Adolfo Cañarte', 'M', '3514036554', '2025-11-13'),
('Eduardo Alberto Lizzul', 'M', '3541577961', '2025-11-13'),
('Laura Carolina Cañarte', 'F', '3518105514', '2025-12-23'),
('Hugo Benigno Arce', 'M', '3516256382', '2026-02-11'),
('Lucia Macarena Navarro Cañarte', 'F', '1157076772', '2026-03-04'),
('Agustín Novoa', 'M', '3543589447', '2026-03-02'),
('Fernando Marcelo Chávez', 'M', '3516716655', '2026-03-07'),
('Bernardo Oscar Arias', 'M', '3512232710', '2026-03-09'),
('Magdalena Brigo', 'F', '3515096181', '2026-03-09'),
('Matías Cañarte Kuseman', 'M', '3514036554', '2026-03-18'),
('Luciana Mulazzi', 'F', '3515495058', '2026-03-26'),
('Alina Cañarte', 'F', '3515311157', '2026-04-09'),
('Beatriz del Valle Arias', 'F', '', NULL),
('Carola Novoa', 'F', '3525537006', '2026-04-18'),
('Maria Laura Sanchez', 'F', '3513746500', '2026-05-02'),
('María Soledad Koljatic', 'F', '3516168303', '2026-05-19'),
('Daniel Mario Navarro Pérez', 'M', '1133088155', '2026-07-07');

-- Ejemplo real de copropietario tomado del Excel ("Agustin y Carola Novoa")
INSERT INTO copropietarios (cliente_id, nombre)
SELECT id, 'Carola Novoa' FROM clientes WHERE nombre = 'Agustín Novoa';
