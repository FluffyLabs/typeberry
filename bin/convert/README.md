# @typeberry/convert

Convert JAM-related types between different formats.

## Usage

```bash
npm start -w @typeberry/convert [options] <type> <input-file> [to <format>]
```

### Options

- `--flavor` - Chain spec flavor: `full` or `tiny` (default: `tiny`)
- `--process` - Process the type before outputting

### Output Formats

- `print` - Print to console (default)
- `json` - JSON format
- `hex` - JAM-codec hex-encoded string

## Example

```bash
# Convert header from JSON to hex
convert header ./genesis-header.json to hex

# Convert with specific flavor
convert --flavor=full header ./genesis-header.json to json

# Convert state dump into chain-spec compatible format
convert --process=truncated-entries state-dump ./genesis-state.json to json
```

Input type is detected from file extension (`.hex` or `.json`).
