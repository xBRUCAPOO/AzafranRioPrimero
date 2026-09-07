<?php
/**
 * config.php
 * Datos de conexión a la base de datos MySQL.
 *
 * En Clever Cloud, al enlazar el add-on de MySQL a la aplicación, la
 * plataforma inyecta automáticamente estas variables de entorno:
 *   MYSQL_ADDON_HOST, MYSQL_ADDON_PORT, MYSQL_ADDON_DB,
 *   MYSQL_ADDON_USER, MYSQL_ADDON_PASSWORD
 * Por eso NO hay que escribir credenciales acá adentro: se leen con
 * getenv(). Si esas variables no existen (por ejemplo, cuando se prueba
 * en la compu con XAMPP), se usan los valores locales de respaldo.
 */

$DB_HOST = getenv('MYSQL_ADDON_HOST') ?: 'localhost';
$DB_PORT = getenv('MYSQL_ADDON_PORT') ?: '3306';
$DB_NAME = getenv('MYSQL_ADDON_DB') ?: 'gestor_clientes';
$DB_USER = getenv('MYSQL_ADDON_USER') ?: 'root';
$DB_PASS = getenv('MYSQL_ADDON_PASSWORD') ?: '';

try {
    // PDO con modo de errores estricto para poder capturarlos en clientes.php
    $pdo = new PDO(
        "mysql:host=$DB_HOST;port=$DB_PORT;dbname=$DB_NAME;charset=utf8mb4",
        $DB_USER,
        $DB_PASS
    );
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    header("Content-Type: application/json; charset=utf-8");
    die(json_encode(["error" => "No se pudo conectar a la base de datos: " . $e->getMessage()]));
}