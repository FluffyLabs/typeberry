# Typeberry benchmarks

To run a new benchmark just create a new directory here and add some `.ts`
files with the bechmark code.
See other files as examples.

# Running

```
$ npm start -w @typeberry/benchmark
```

The top-level `start` command of `@typeberry/benchmark` package will run all
benchmarks in this folder, and create results in `<benchmark-name>/output` directory.

# Maintaining performance

If a JSON file `<benchmark-name>/expected/<file>.json` exists, the benchmark
runner will additionally compare the results of execution with the expected
results. The format of the file is the same as the `output` JSON file.

If the exact results are not that important, and we only care about the
`fastest` case. It's possible to set `results` to a `null` value in the `expected`
file.

The summary of execution of the benchmarks is created in
`./dist/benchmarks/results.json` and `./dist/benchmarks/results.txt` files. When
benchmarks are running on Github, the latter will be posted as a comment to the PR.
