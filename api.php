<?php
/**
 * Файл API для керування процесом завантаження
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     PHPUtils/Upload
 * @link        http://upload.loc
 * @copyright   Всі права застережено (c) 2018 Upload
 */

$output = [];

try {

    if (!isset($_GET['action'])) throw new Exception('Відсутня дія');

    if (!isset($_POST['name'])) throw new Exception('Відсутня назва файлу');

    require_once('File.php');

    $file = new File($_POST['name'], (($_POST['hash']) ?? null));

    switch($_GET['action']) {

        case 'open': $output['hash'] = $file->open(); break;

        case 'append': $output['size'] = $file->append(($_FILES['chunk']) ?? null); break;

        case 'close': $output['size'] = $file->close(($_POST['time']) ?? null); break;

        case 'remove': $file->remove(); break;

        case 'size': $output['size'] = $file->size(); break;

        default: throw new Exception('Невідома дія');
    }

} catch (Exception $exception) {

    header('HTTP/1.x 500 Internal Server Error');

    if (isset($file) && is_object($file)) $file->remove();

    $output['exception'] = $exception->getMessage();
}

$output['debug'] = ['$_GET' => $_GET, '$_POST' => $_POST, '$_FILES' => $_FILES];

echo json_encode($output, JSON_UNESCAPED_UNICODE);
