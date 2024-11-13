# Try Expression Proposal

_Handling JSON.parse with less code._

Extends the `try` keyword to support for expressions, returning a tuple of [error, result] instead of throwing an error or using a catch statement.

## Status

- Champion(s): None yet?
- Author(s): Arlen Beiler
- Stage: -1

## Motivation

The try...catch statement is used frequently in all areas of Javascript, but the lack of support for expressions requires continuous workarounds in user code.

The most common methods are either error-prone or require awkward syntax structures. `JSON.parse` may be the most obvious example. A `JSON.parse` call requires a minimum of 2 lines, and to be properly readable, 6 lines.

Another very common use-case is catching errors from awaited promises, especially promises from file system or database calls, where errors often have direct bearing on your next step. Add a generic catch statement after every database call just to marshal the error back into your code is fairly easy, but it's still extra code that has to be documented and double-checked next time you want to use it for something else.

And that only works for async functions. Functions which return their value directly have no such equivelant feature and must at least use a helper function to catch errors. And then you have to include it in every file and you have to remember the exact syntax, and sometimes it's easier to just not use it, but then you lose the benefit of checking for an error.

- **Simplified Error Handling**: Streamline error management by eliminating the need for try-catch blocks and parent-scoped result variables.
- **Enhanced Readability**: Improve code clarity by reducing nesting and making the flow of error handling more intuitive.
- **Consistency Across APIs**: Establish a uniform approach to error handling across various APIs, and between sync and async, ensuring predictable behavior.
- **Improved Security**: Reduce the risk of overlooking error handling, thereby enhancing the overall security of the code.

Typescript already supports the typing of tuples, so this proposal is Typescript-friendly.


## Example

How often have you seen code like this?

```ts
async function getData() {
  const response = await fetch("https://api.example.com/data");
  const json = await response.json();
  return validationSchema.parse(json);
}
```

The issue with the above function is that it can fail silently, potentially crashing your program without any explicit warning.

1. `fetch` can reject.
2. `json` can reject.
3. `parse` can throw.
4. Each of these can produce multiple types of errors.

The current solution is to surround each step in a try-catch statement, use var (or let in the parent block) to get the result, and continue. If you want more robust code which doesn't accidentally forget to declare or assign one of the variables, you can nest the try catch statements, or put each of the calls in a child function. All solutions have a lot of boilerplate syntax.

```ts
function getData() {
  let response, json;

  try {
    response = await fetch("https://api.example.com/data");
  } catch (e) {
    handleRequestError(e);
    return;
  }

  try {
    json = await response.json();
  } catch (e) {
    handleParseError(e);
    return;
  }

  try {
    // straight up forgetting to declare this, so it gets declared as a global
    schema = validationSchema.parse(json);
  } catch (e) {
    handleValidationError(e);
    return;
  }

  return schema;
}
```

To address this, we propose the adoption of a new expression keyword (`try`), which facilitates more concise and readable error handling.

```ts
async function getData() {

  const [requestError, response] = try await fetch("https://api.example.com/data")
  if (requestError) return void handleRequestError(requestError.inner);

  const [parseError, json] = try await response.json()
  if (parseError) return void handleParseError(parseError.inner);

  const [validationError, schema] = try validationSchema.parse(json)
  if (validationError) return void handleValidationError(validationError.inner);

  return data
}
```

## The Proposed Solution

Example parsing implemented in TypeScript: 

https://github.com/Arlen22/TypeScript/tree/arlen22-0.2

### The try expression

```ts
const [error, data] = try itfails();
// or
const [error, data] = try await itfails();

if(error){
  // error handling code
  return;
}
//do something with data
return data;

```

The try keyword indicates that any error thrown by the expression to the right of the keyword should be caught and returned as a tuple, rather than thrown.

Similar to the body of an arrow function, the presense of curly brackets `{}` is interpreted as a try statement and the absence as a try expression.

Because it returns a tuple, it will almost always be used in conjunction with a destructuring assignment.

### Operator precedence

I'm still working on this part but variable assignment and arrow function body (for things like rxjs) are the two most common uses of the try expression. So it at least needs to take precedence there. 

### The TryError class

```js
class TryError extends Error {
  constructor(inner) {
    // Coercing to a string won't work for anything which was created with Object.create(null).
    let message;
    try {
      message = `${inner}`;
    } catch (e) {
      message = "[unknown]";
    }
    super(message);
    this.name = "TryError";
    this.inner = inner;
  }
}
```

### Example Implementation

Here we have the TryError class and two helper functions. The `try_await_` function simulates calls that look like `try await itfails()`, and the `try_` function simulates calls that look like `try itfails()`. The `try_await_` function is necessary because the try keyword by itself does not await promises, it simply passes them through.

```js

/** The fn should await its promises that way the stack trace points there instead of here. */
async function try_await_(
  fn: () => Promise<T>
): Promise<[TryError, undefined] | [undefined, T]> {
  try {
    // The await keyword has no effect on non promises
    // but since this is a function we have to await it anyway.
    // this is the main difference between the helper function and an actual try expression
    else return [undefined, await fn()];
  } catch (e) {
    return [new TryError(e), undefined];
  }
}
/** This won't catch Promises, you have to use try_await_ for that. */
function try_<T>(fn: () => T): [TryError, undefined] | [undefined, T] {
  try {
    return [undefined, fn()];
  } catch (e) {
    return [new TryError(e), undefined];
  }
}

const [error, data] = try_(() => JSON.parse("undefined"));

// error.inner.message === '"undefined" is not valid JSON'
// error.message === 'SyntaxError: "undefined" is not valid JSON'
// error.toString() === 'TryError: SyntaxError: "undefined" is not valid JSON'
// data === undefined;
```

### Promises, Generators, and other semantics

Because await semantically turns a promise rejection into an error thrown from the location of the await, it should be immediately caught by the try expression in the same way a try statement would catch it, and then return the tuple.

```ts
const [error1, data1] = try await Promise.reject("awaited promise");
console.log(error1); // TryError: awaited promise
console.log(data1); // undefined

const [error2, data2] = try Promise.reject("returned promise");
console.log(error2); // undefined
console.log(data2); // Promise { <rejected>: "returned promise" }
```

#### Generators and yield

Calling a generator function constructs a Generator object. Each time the generator's `next()` method is called, the generator resumes execution. The throw() method of Generator instances acts as if a throw statement is inserted in the generator's body at the current suspended position, which informs the generator of an error condition and allows it to handle the error, or perform cleanup and close itself. If the yield point is inside a try expression, the error should be caught accordingly.

## Use cases

This allows us to try-catch an expression like `JSON.parse(...)` with much less code, and also allows us to use `const` instead of `let` or `var`.

```js
// quick and dirty (and no Typescript support)
let jsonbody;
try {
  jsonbody = JSON.parse(body);
} catch (e) {
  // handle the error
}

//or more robust (Typescript friendly) and verbose IIFE
const [error1, jsonbody] = (() => {
  try {
    return [undefined, JSON.parse(body)];
  } catch (e) {
    return [new TryError(e), undefined];
  }
})();
if (error1) {
  //handle the error
}
```

Becomes

```js
// always robust
const [error1, jsonbody] = try JSON.parse(body);

if(error1) {
  //handle the error
}
```

In addition, when performing I/O operations or otherwise interacting with Promise-based APIs, sync and async errors occur routinely and must be handled efficiently with as little boilerplate as possible. The `try` expression simplifies this process.

<br />

```js
// does it always return a rejected promise or can it throw?
const [error, response] = await fetch("https://arthur.place").then(
  (e) => [undefined, e],
  (e) => [new TryError(e), undefined]
);
if (error) {
  alert("error fetching the data");
  return;
}
```

Becomes

```js
const [error, response] = try await fetch("https://arthur.place");

if(error) {
  alert("error fetching the data");
  return;
}
```

### Current alternatives to the try expression include:

#### Do nothing:

```ts
const data = await itfails();
const data2 = itfails2(data);
```

#### Quick and dirty:

```ts
// can't use const, and have to make sure we don't forget any
let data;
try {
  data = await itfails();
} catch (e) {
  // error handling code
}
try {
  // we forgot to declare data2 (or misspelled it), so now it's in global scope
  data2 = itfails2(data);
} catch (e) {
  // error handling code
}
// return global scope
return data2;
```

#### Wrapping in an IIFE (very verbose)

```ts
const [error, data] = await(async () => {
  try {
    return [undefined, await itfails()];
  } catch (e) {
    return [new TryError(e), undefined];
  }
})();
if (error) {
  // error handling code
  return;
}
// hard to forget the const here, but...
[error2, data2] = (() => {
  try {
    return [undefined, itfails2(data)];
  } catch (e) {
    return [new TryError(e), undefined];
  }
})();
//do something with data
return data2;
```

#### Using the `try_` helper function (slightly verbose, but it's an expression)

```ts
// const [error,data] = try await itfails();
const [error, data] = await try_await_(async () => await itfails());

if (error) {
  // error handling code
  return;
}

// const [error2,data2] = try itfails2(data);
const [error2, data2] = try_(() => itfails2(data));

if (error2) {
  // error handling code
  return;
}
//do something with data
return data;
```

#### Using a try expression (this proposal)

```ts

const [error1, data] = try await itfails();
if(error1) {
  // error handling code
  return;
}
const [error2, data2] = try itfails2(data);
if(error2) {
  // error handling code
  return;
}
return data;

```

## Description

_Developer-friendly documentation for how to use the feature._

### Syntax

```ts
const [error, data] = try await expression;
const [error, data] = try expression;
// error.inner.message === 'message'
// error.message === 'SyntaxError: message'
// error.toString() === 'TryError: SyntaxError: message'
```

### Definitions

#### Expression:

An expression is any Javascript which can be used as the condition of an if statement, the value of a return keyword, inside parentheses, or as the value of a variable assignment.

#### The `try` keyword:

a reserved word in Javascript which can currently only be used to denote try statements, but would now be extended to also denote try expressions. Importantly, the word `try` cannot be used as a function name, so there is no situation where the try keyword can currently be used in an expression.

#### The `try` expression:

a new usage of the `try` keyword which simplifies error handling by transforming the result of an expression into a tuple. If the expression throws an error, the keyword returns `[TryError, undefined]`; if the expression executes successfully, it returns `[undefined, result]`.

#### `TryError` class

A new class which extends the Error class. It is used to wrap the error thrown by the expression in the try expression. It has a property `inner` which contains the original error.

#### A function that throws an error.

```ts
function itfails() {
  throw new Error("Some error we throw");
}
```

## Why Not `data` First?

In Go, the convention is to place the data variable first, and you might wonder why we don't follow the same approach in JavaScript. In Go, this is the standard way to call a function. However, in the JavaScript ecosystem, most callbacks already put the error first, so this is not a foriegn concept.

In addition, we already have the option to use `const data = fn()` and choose to ignore the error, which is precisely the issue we are trying to address. If someone is using the try keyword, it is because they want to ensure that they handle errors, not forget them. Placing the data first would contradict this principle, as it prioritizes the result over error handling.

```ts
// ignores errors!
const data = fn()

// Look how simple it is to forget to handle the error if data is first
const [data] = try fn()

// This is the way to go
const [error, data] = try fn()
```

If you want to suppress the error (which is **different** from ignoring the possibility of a function throwing an error), you can simply do the following:

```ts
// This intentionally suppresses the error (ignores it and doesn't re-throw it)
const [, data] = try fn();

// with JSON.parse, for example:
const [, data1] = try JSON.parse("<html>my html</html>");
if(data1 === undefined) return;
```

This approach is much more explicit and readable because it acknowledges that there might be an error, but indicates that you do not care about it.

## Limitations

### `await try` expression

The `await` keyword can only be used with a Promise, and the `try` expression does not return a Promise. Putting `await` in front of a `try` expression would have no effect. This should be a linter error.

### No catch statement

The `try` expression does not support a `catch` statement. While it could, this would make the syntax more complex and less readable and probably result in people putting catch blocks in weird locations. Instead, the `try` expression should be used in conjunction with an `if` statement.

### No finally statement

The `try` expression guarentees that the code after it will run, so there is no need for a `finally` statement.

```ts
const [error, data] = try itfails();
// this code will always run
closeFile();
```

However, the following code will still work as expected.

```ts
const [error, data] = try itfails();
try {
  if(error){
    // error handling code
    return;
  } else {
    //do something with data
    return data;
  }
} finally {
  // this code will always run
  closeFile();
}
```

## Inspiration

- [Arthur Fiorette's Safe Assignment Operator Proposal](https://github.com/arthurfiorette/proposal-safe-assignment-operator)

I was going to help him out by rewriting the proposal around the Try Expression, which he already said he wanted to do, but the entire thing was so different that I decided to make my own proposal. However, a lot of the discussions there contributed to this proposal.
