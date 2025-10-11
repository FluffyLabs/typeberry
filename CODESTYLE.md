TODO [ToDr] This is just a stub.

## Naming conventions

1. `*.test.ts` - test files
2. `*.node.ts` - Node runtime specific files.
3. `*.web.ts` - Web Browser runtime specific files.

Files without a special convention must be compatible with both node and web
environment (aka "core" files).

## Repository structure

1. `./bin` - full-featured binaries that are core to typeberry.
2. `./packages/extensions` - optional features of the client.
3. `./packages/core` - re-usable libraries that are JAM-agnostic. May only depend
    on other `core` packages and never `jam`.
4. `./packages/jam` - self-contained parts of the typeberry implementation.
    Think: libraries, but specific to JAM. Always named `@typeberry/<name>`.
5. `./packages/workers` - parts of typeberry that run as a worker. And communicate with
    other components. Use `./packages` for their underlying logic.
6. `./packages/misc` - auxiliary, non-production utilities that don't fit anywhere else.

## NPM workspace

Since we're using NPM workspaces, each workspace (i.e. sub-project/library/package)
should have it's own set of scripts. Avoid polluting the main `package.json` with
scripts to run, instead move the script as close to the package that will be run
as possible.

Below some pre-defined scripts and their expected behaviour:
1. `test` - obligatory script to run tests from a package. Usuall the command is
    exactly the same for all of the packages.
2. `start` - optional script to execute the package. Note that it's not limited
    only to `./bin` packages.
3. `build` - if package can be built into a ESM and later potentially
    published to NPM registry that should be the command which produces the final
    JS file in `./dist` directory.

## Avoid constructor overloading

Constructor overloading can be pretty misleading. To avoid confusion about how the
object is created we should be using `static` builder methods.

The constructor can (or even must!) be there anyway, but should not have any logic,
rather should just assign a bunch of fields.

The rest should stay in the build methods. Naming should follow Rust convention,
with builder method names like: `Bytes.fromString` or `Bytes.withLength`, etc.

## Avoid dependencies

Any external dependencies need to be chosen carefuly to avoid supply chain attacks.
It's better to re-write just what you need than to bring in an entire package.

However be careful with building your own framework/lib. Think of the limit
of where you want your homegrown thing to get. State the limit in the
documentation or make sure to act in a review, when the class/util goes beyond
it and in such case consider bringing in an external library.

The cost of having a half-baked frankenstein is worse than bringing in a good
& estabilished library. Make sure to choose carefuly however, check the
dependencies of the library itself and prefer speed & simplicity and no to
little dependencies over functionality.

## Avoid allocations & data copying

While it's nearly impossible to avoid all allocations in TypeScript,
we might try to limit allocations of large objects
and re-use the memory as much as possible.

The goal is to avoid stop-the-world GC pauses.

Wherever possible prefer `ArrayBuffer` and it's views over regular numeric arrays.

Try to also think if some operations can be defered to a later time, especially
if you don't know if they are going to be called anyway.
 
Avoid copying large chunks of memory (i.e. `Uint8Array`s) to some other arrays.
Prefer returning subarrays from a larger allocated chunk and creating view objects.
Note there is `subarray` function that should be preferred over `slice`.

# Opaque types and naming

1. Prefer using `Opaque` types, like `U32/U16/U8` to represent fixed-size numbers.
2. Cast using `as` ONLY when there is no other option, since over time the `as`
   cast might be easily broken.
3. When you have a function that converts between one type to another use `ensure`
   or `check` to verify that the value is correct.
4. Use `tryAs*` convention to indicate that there might be exception being thrown
   (however never rely on the exception - do any checks BEFORE attempting to cast).

# Exceptions

1. Usage of exceptions should be rare - it should indicate development bug not
   regular behaviour.
2. You should not rely on specific exceptions to be thrown and caught in other
   places - rather use explicit return types for this.
3. Especially avoid catching exceptions coming from `check` and `ensure` since
   these might be removed in the production code.

# Reviews

The point of the review is not to show off your skills or prove that you are
smarter than the reviewee. The point is to make them a better programmer
and ensure that the code that's going to be included is:
1. Correct
2. High quality

It doesn't need to be perfect, and may inhibit signs of individual coder's style.
That's okay.

Performance critical code should be measured (micro benchmarked) and only then
some controversial perf-related suggestions should be applied.

## Merge Pull Request Process

1. The PR is **opened** by the author and is _no longer a draft_.
2. Draft PRs _can be_ reviewed, but the _comments do not need to be addressed_ if
    the code is subject to change anyway.
3. The author **requests 1 or more** reviewers to review the PR.
4. **At least two _requested_** reviewers **must approve** the PR (unless only one was
    requested). No unresolved discussions may remain.
5. Non-requested core devs may still volunteer a review. **If they leave any comments,
    their explicit approval is required before merging.**
6. If a reviewer **does not leave comments**, the review status **must be** **`Approve`**.
7. If **any comments** are left, the status may be one of:
    1. **`Approve`** - **re-review is not required**, the reviewer trusts the author to
        fix all the issues at their free discretion. Reply comments are not required.
        If the PR is all-approved, author **can resolve** comments under **approved review**
        and merge PR after CI passes.
    2. **`Comment`** - reviewer is opening a discussion with the author to address
        some of the issues. Addressing _DOES not necessarily mean fixing_ as reviewer
        requested, but rather might just require a _reply comment_ with justification
        for the code in question. **Re-review** of addressed issues is **required**.
        The author **does not resolve discussions**.
    3. **`Request Changes`** - the reviewer has a strong opinion that the code should
        not be merged in its current form. The author MUST consider either changing
        the code or persuading the reviewer that their view is wrong.
        The author **does not resolve discussions**.

8. At any point in time, when the PR is all-approved it can be merged. To simplify
    the process, the **last reviewer to approve a PR is requested to merge** it immediately
    after approval.

# Priorities

To ensure a smooth development process and a positive experience for contributors,
repository maintainers should follow these priorities:

  1. Reviewing open Pull Requests.
  2. Addressing review feedback in open Pull Requests.
  3. Finishing implementation of already started issues.
  4. Picking new issues - preferably high-priority ones.

The top priority for maintainers is reviewing PRs when requested. Likewise, PR
authors should address review comments promptly. Both reviewing and addressing
feedback take precedence over ongoing work - the faster they're handled,
the better. Our goal is to avoid PRs sitting in review for more than 1-2 days.
If a PR sees no activity for 7 days, it should be considered for closing.

Only after handling reviews should you focus on your current tasks. When doing so,
prioritize finishing what you've already started before picking up anything new.

That said, working on multiple things at once is fine. It's perfectly acceptable
to mix smaller tasks with larger ones. The key is to ensure steady, visible
progress across the whole codebase.

Maintainers should aim to take at least one meaningful action every working day.
This could be something small (fixing a typo, reviewing a PR), medium (responding
to review comments, adding a small feature, or suggesting a rename), or large
(implementing a feature, doing a major refactor). The important thing is to build
the habit of making some kind of improvement every day.
