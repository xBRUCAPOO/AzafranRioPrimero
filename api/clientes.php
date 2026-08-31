<?php
/**
 * clientes.php
 * API REST muy simple para el CRUD de clientes + copropietarios sobre MySQL.
 * Endpoints (todos vía /api/clientes.php):
 *   GET    ?id=1                       -> un cliente con sus copropietarios
 *   GET    ?q=texto&sexo=M&estadoCivil=Soltero/a -> lista filtrada
 *   POST   (body JSON)                 -> crea un cliente nuevo
 *   PUT    ?id=1  (body JSON)          -> actualiza un cliente existente
 *   DELETE ?id=1                       -> elimina un cliente (y sus copropietarios, por CASCADE)
 */

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit; // Petición de "preflight" CORS, no requiere respuesta con contenido
}

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? (int) $_GET['id'] : null;

// Trae los copropietarios asociados a un cliente puntual
function obtenerCopropietarios($pdo, $clienteId) {
    $stmt = $pdo->prepare("SELECT id, nombre, dni FROM copropietarios WHERE cliente_id = ?");
    $stmt->execute([$clienteId]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

// Guarda (crea o actualiza) un cliente junto con sus copropietarios
function guardarCliente($pdo, $data, $id) {
    if (isset($data['copropietarios']) && count($data['copropietarios']) > 3) {
        http_response_code(400);
        echo json_encode(["error" => "Un cliente puede tener como máximo 3 copropietarios"]);
        exit;
    }

    $campos = [
        'nombre' => $data['nombre'] ?? '',
        'sexo' => $data['sexo'] ?? 'M',
        'dni' => $data['dni'] ?? '',
        'cuil' => $data['cuil'] ?? '',
        'fecha_nacimiento' => !empty($data['fechaNacimiento']) ? $data['fechaNacimiento'] : null,
        'telefono' => $data['telefono'] ?? '',
        'mail' => $data['mail'] ?? '',
        'fecha_alta' => !empty($data['fechaAlta']) ? $data['fechaAlta'] : null,
        'estado_civil' => $data['estadoCivil'] ?? '',
        'profesion' => $data['profesion'] ?? '',
        'direccion' => $data['direccion'] ?? '',
        'referente' => $data['referente'] ?? '',
    ];

    if ($id) {
        $sql = "UPDATE clientes SET nombre=:nombre, sexo=:sexo, dni=:dni, cuil=:cuil,
                fecha_nacimiento=:fecha_nacimiento, telefono=:telefono, mail=:mail,
                fecha_alta=:fecha_alta, estado_civil=:estado_civil, profesion=:profesion,
                direccion=:direccion, referente=:referente WHERE id=:id";
        $campos['id'] = $id;
        $pdo->prepare($sql)->execute($campos);
        $clienteId = $id;
    } else {
        $sql = "INSERT INTO clientes (nombre, sexo, dni, cuil, fecha_nacimiento, telefono, mail,
                fecha_alta, estado_civil, profesion, direccion, referente)
                VALUES (:nombre, :sexo, :dni, :cuil, :fecha_nacimiento, :telefono, :mail,
                :fecha_alta, :estado_civil, :profesion, :direccion, :referente)";
        $pdo->prepare($sql)->execute($campos);
        $clienteId = $pdo->lastInsertId();
    }

    // Se reemplazan los copropietarios existentes por los recibidos (evita duplicados al editar)
    $pdo->prepare("DELETE FROM copropietarios WHERE cliente_id = ?")->execute([$clienteId]);
    if (!empty($data['copropietarios'])) {
        $stmtCo = $pdo->prepare("INSERT INTO copropietarios (cliente_id, nombre, dni) VALUES (?, ?, ?)");
        foreach ($data['copropietarios'] as $co) {
            if (!empty($co['nombre']) || !empty($co['dni'])) {
                $stmtCo->execute([$clienteId, $co['nombre'] ?? '', $co['dni'] ?? '']);
            }
        }
    }

    echo json_encode(["ok" => true, "id" => (int) $clienteId]);
}

switch ($method) {
    case 'GET':
        if ($id) {
            $stmt = $pdo->prepare("SELECT * FROM clientes WHERE id = ?");
            $stmt->execute([$id]);
            $cliente = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$cliente) {
                http_response_code(404);
                echo json_encode(["error" => "Cliente no encontrado"]);
                exit;
            }
            $cliente['copropietarios'] = obtenerCopropietarios($pdo, $id);
            echo json_encode($cliente);
        } else {
            // Búsqueda/filtro por texto, sexo y estado civil vía parámetros de la URL
            $sql = "SELECT * FROM clientes WHERE 1=1";
            $params = [];
            if (!empty($_GET['q'])) {
                $sql .= " AND (nombre LIKE ? OR dni LIKE ? OR mail LIKE ?)";
                $like = "%" . $_GET['q'] . "%";
                array_push($params, $like, $like, $like);
            }
            if (!empty($_GET['sexo']) && $_GET['sexo'] !== 'todos') {
                $sql .= " AND sexo = ?";
                $params[] = $_GET['sexo'];
            }
            if (!empty($_GET['estadoCivil']) && $_GET['estadoCivil'] !== 'todos') {
                $sql .= " AND estado_civil = ?";
                $params[] = $_GET['estadoCivil'];
            }
            $sql .= " ORDER BY nombre ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $lista = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($lista as &$c) {
                $c['copropietarios'] = obtenerCopropietarios($pdo, $c['id']);
            }
            echo json_encode($lista);
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        guardarCliente($pdo, $data, null);
        break;

    case 'PUT':
        if (!$id) { http_response_code(400); echo json_encode(["error" => "Falta el id"]); exit; }
        $data = json_decode(file_get_contents('php://input'), true);
        guardarCliente($pdo, $data, $id);
        break;

    case 'DELETE':
        if (!$id) { http_response_code(400); echo json_encode(["error" => "Falta el id"]); exit; }
        $pdo->prepare("DELETE FROM clientes WHERE id = ?")->execute([$id]);
        echo json_encode(["ok" => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(["error" => "Método no permitido"]);
}
