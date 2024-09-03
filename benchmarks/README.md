# Typeberry benchmarks

To run a new benchmark just create a new directory here and add some `.ts`
files with the bechmark code.
See other files as examples.

# Running

```
$ npm run benchmarks
```

The top-level `benchmarks` command will run all benchmarks in this folder,
and create results in `<benchmark-name>/output` directory.

# Maintaining performance

If a JSON file `<benchmark-name>/expected/<file>.json` exists, the benchmark
runner will additionally compare the results of execution with the expected
results. The summary of execution of the benchmarks is created in
`./results.json` and `./results.txt` files. When benchmarks are running on
Github, the latter will be posted as a comment to the PR.

