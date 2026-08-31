<?php
/**
 * config.php
 * Datos de conexión a la base de datos MySQL "gestor_clientes".
 * IMPORTANTE: completar $DB_HOST/$DB_USER/$DB_PASS según el servidor real
 * (en local con XAMPP/WAMP suele ser host="localhost", user="root", pass="").
 */

$DB_HOST = "localhost";
$DB_NAME = "gestor_clientes";
$DB_USER = "root";
$DB_PASS = "39302271";

try {
    // PDO con modo de errores estricto para poder capturarlos en clientes.php
    $pdo = new PDO(
        "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
        $DB_USER,
        $DB_PASS
    );
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    header("Content-Type: application/json; charset=utf-8");
    die(json_encode(["error" => "No se pudo conectar a la base de datos: " . $e->getMessage()]));
}
