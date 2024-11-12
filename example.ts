class TryError<T = any> extends Error {
  inner: T;
  constructor(inner) {
    // oh the irony! We have to do this because Error coerces the inner object to a string for the message. This works for Error objects, and anything else which implements toString(), including anything which inherits from Object, but it won't work for anything which was created with Object.create(null). 
    let message;
    try { message = `${inner}`; } catch (e) { message = "[unknown]" }
    super(message);
    this.name = "TryError";
    this.inner = inner;
  }
}

function try_<T>(fn: () => Promise<T>): Promise<[TryError, undefined] | [undefined, T]>;
function try_<T>(fn: () => T): [TryError, undefined] | [undefined, T];
function try_(fn: () => any): any {
  try {
    const result = fn();
    if (result instanceof Promise)
      return result.then(
        (r) => [undefined, r],
        (e) => [new TryError(e), undefined]
      );
    else return [undefined, result];
  } catch (e) {
    return [new TryError(e), undefined];
  }
}


async function test() {
  const [error1, data1] = try_((): 25 => {
    throw new Error("Error");
  });
  if (error1) {
    console.log(error1, data1);
  } else {
    console.log(error1, data1);
  }
  const [error2, data2] = await try_(async (): Promise<number> => {
    throw new Error("error");
  });
  if (error2) {
    console.log(error2, data2);
  } else {
    console.log(error2, data2);
  }

}

function test2() {
  const body = "";
  // quick and dirty
  let jsonbody;
  try {
    jsonbody = JSON.parse(body) as {};
  } catch (e) {
    // handle the error
    throw "Error";
  }
  jsonbody;
}

function test3() {
  const t1 = async () => someExpression() ?? otherexpression() ? true : false;
  const t2 = await someExpression() ?? await otherexpression() ? await true : await false;
  const t3 = (() => someExpression() ?? otherexpression() ? true : false, undefined)
  const t4 = 5 + [undefined, 5];
  const some = async (): Promise<1> => 1;
  const other = async (): Promise<2> => 2;
  const t5 = await some() ?? await other();
  const t6 = try_(() => some() ?? () => other() ? true : false);
}