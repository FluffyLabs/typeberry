TODO [ToDr] This is just a stub.

## Naming conventions

1. `*.test.ts` - test files
2. `*.node.ts` - Node runtime specific files.
3. `*.web.ts` - Web Browser runtime specific files.

Files without a special convention must be compatible with both node and web
environment (aka "core" files).

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

## Avoid allocations

While it's nearly impossible to avoid all allocations in TypeScript,
we might try to limit allocations of large objects
and re-use the memory as much as possible.

The goal is to avoid stop-the-world GC pauses.

Wherever possible prefer `ArrayBuffer` and it's views over regular numeric arrays.
Note there is `subarray` function that should be preferred over `slice`.


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

## Process

1. The PR is opened by the author and is no longer a draft.
2. Draft PRs can be reviewed, but the comments does not need to be addressed if
    the code is subject to change anyway.
3. The author requests 1 or more persons to review the PR.
4. All REQUESTED reviewers must approve the PR. Non-requested core devs may still
    review the PR and in such case their approval is required too (i.e.
    self-select themselves).
5. If the reviewer does not leave any comments the approval status must be `Approve`.
6. If some comments are left the status might be one of:
    1. `Approve` - re-review is not required, the reviewer trusts the author to
        fix all the issues at their free discretion. Reply comments are not required.
        If the PR is all-approved can be merged by the author after CI passes.
    2. `Comment` - reviewer is opening a discussion with the author to address
        some of the issues. Addressing DOES not necessarily mean fixing as reviewer
        requested, but rather might just require a reply comment with justification
        for the code in question. Re-review of addressed issues is required.
        The author does not resolve discussions.
    3. `Request Changes` - the reviewer has a strong opinion that the code should
        not be merged in it's current form. The author must consider either changing
        the code or persuading the reviewer that their view is wrong.

7. At any point in time, when the PR is all-approved it can be merged. To simplify
    the process the last reviewer to approve a PR is requested to merge it right
    after.
