<?php
/**
 * Файл з API для керування процесом завантаження
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     Upload
 * @link        http://upload.local
 * @copyright   Всі права застережено (c) 2019 Upload
 */

$output = [];

// Шлях до теки зберігання завантажених файлів
$path = __DIR__ . '/uploads';

// Шлях до теки тимчасового зберігання файла під час завантження
$pathTemporary = __DIR__  . '/uploads/.tmp';

require_once('File.php');

try {

    if (!isset($_GET['action'])) throw new Exception('Відсутня дія');

    if (!isset($_POST['name'])) throw new Exception('Відсутня назва файлу');

    $file = new File($_POST['name']);

    // Встановлюємо шлях до теки зберігання завантажених файлів
    $file->setPath(__DIR__ . '/uploads');

    // Встановлюємо шлях до теки тимчасового зберігання файла під час завантження
    $file->setPathTemporary(__DIR__  . '/uploads/.tmp');

    // Встановлюємо хеш файлу що завантажується
    if (isset($_POST['hash'])) $file->setHash($_POST['hash']);



    switch($_GET['action']) {

        case 'open': $output['hash'] = $file->open(); break;

        case 'append': $output['size'] = $file->append(($_FILES['chunk']) ?? null); break;

        case 'close': $output['size'] = $file->close(($_POST['time']) ?? null); break;

        case 'remove': $file->remove(); break;

        //case 'size': $output['size'] = $file->size(); break;

        default: throw new Exception('Невідома дія');
    }

} catch (Exception $exception) {

    header('HTTP/1.x 500 Internal Server Error');

    if (isset($file) && is_object($file)) $file->remove();

    $output['exception'] = $exception->getMessage();
}

$output['debug'] = ['$_GET' => $_GET, '$_POST' => $_POST, '$_FILES' => $_FILES];

echo json_encode($output, JSON_UNESCAPED_UNICODE);
