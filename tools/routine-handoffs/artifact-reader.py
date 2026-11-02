"""Read report archives without extracting paths or executing their contents."""
import json
import pathlib
import stat
import sys
import zipfile


def read_archive(filename):
    result, size = [], 0
    with zipfile.ZipFile(filename) as archive:
        for entry in archive.infolist():
            name = pathlib.PurePosixPath(entry.filename.replace('\\', '/'))
            if name.is_absolute() or '..' in name.parts or ':' in entry.filename or stat.S_ISLNK(entry.external_attr >> 16):
                raise ValueError('UNSAFE_ARCHIVE_PATH')
            if entry.is_dir() or name.suffix.lower() not in {'.json', '.jsonl', '.txt', '.md'}:
                continue
            size += entry.file_size
            if entry.file_size > 2_000_000 or size > 64_000_000:
                raise ValueError('REPORT_ARCHIVE_FORMAT_LIMIT')
            data = archive.read(entry)  # Includes ZIP CRC validation.
            result.append({'name': str(name), 'text': data.decode('utf-8-sig')})
    return result


if __name__ == '__main__':
    try:
        print(json.dumps(read_archive(sys.argv[1])))
    except (OSError, ValueError, zipfile.BadZipFile, UnicodeError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
