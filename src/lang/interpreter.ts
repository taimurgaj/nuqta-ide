import { type Program, type Stmt, type Expr, type FuncDeclStmt, type ClassDeclStmt } from './parser'

interface UrduObject {
  readonly className: string
  readonly fields: Record<string, UrduValue>
  readonly methods: Map<string, FuncDeclStmt>
}

interface UrduList {
  readonly items: UrduValue[]
}

type UrduValue = string | boolean | number | UrduObject | UrduList

function isList(v: UrduValue): v is UrduList {
  return typeof v === 'object' && v !== null && 'items' in v
}

function isObject(v: UrduValue): v is UrduObject {
  return typeof v === 'object' && v !== null && 'className' in v
}

export class RuntimeError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'RuntimeError'
  }
}

export class CancelledError extends Error {
  constructor() {
    super('روکا گیا')
    this.name = 'CancelledError'
  }
}

// Non-error control signal for واپس (return)
class ReturnSignal {
  constructor(public readonly value: UrduValue | null) {}
}

export interface IO {
  print: (value: string) => void
  input: () => Promise<string>
}

const MAX_STEPS = 10_000
const MAX_DEPTH = 200

export async function interpret(program: Program, io: IO, isCancelled?: () => boolean): Promise<void> {
  const funcs: Map<string, FuncDeclStmt> = new Map()
  const classes: Map<string, ClassDeclStmt> = new Map()

  // Hoist all top-level declarations
  for (const stmt of program.stmts) {
    if (stmt.type === 'FuncDecl')  funcs.set(stmt.name, stmt)
    if (stmt.type === 'ClassDecl') classes.set(stmt.name, stmt)
  }

  const globalScope: Record<string, UrduValue> = {}
  let steps = 0
  let depth = 0

  for (const stmt of program.stmts) {
    if (stmt.type === 'FuncDecl' || stmt.type === 'ClassDecl') continue
    await runStmt(stmt, globalScope)
  }

  // ── Call a named function ────────────────────────────────────────────────

  async function callFunction(
    decl: FuncDeclStmt,
    args: UrduValue[],
  ): Promise<UrduValue | null> {
    if (++depth > MAX_DEPTH) throw new RuntimeError('فنکشن بہت گہرا — دو سو مراحل سے زیادہ')
    const localScope: Record<string, UrduValue> = {}
    for (let i = 0; i < decl.params.length; i++) {
      localScope[decl.params[i] ?? ''] = args[i] ?? 0
    }
    let result: UrduValue | null = null
    for (const s of decl.body) {
      const sig = await runStmt(s, localScope)
      if (sig instanceof ReturnSignal) { result = sig.value; break }
    }
    depth--
    return result
  }

  // ── Call a method on an object ───────────────────────────────────────────

  async function callMethod(
    instance: UrduObject,
    decl: FuncDeclStmt,
    args: UrduValue[],
  ): Promise<UrduValue | null> {
    if (++depth > MAX_DEPTH) throw new RuntimeError('فنکشن بہت گہرا — دو سو مراحل سے زیادہ')
    // یہ is bound as 'یہ' in the local scope
    const localScope: Record<string, UrduValue> = { 'یہ': instance }
    for (let i = 0; i < decl.params.length; i++) {
      localScope[decl.params[i] ?? ''] = args[i] ?? 0
    }
    let result: UrduValue | null = null
    for (const s of decl.body) {
      const sig = await runStmt(s, localScope)
      if (sig instanceof ReturnSignal) { result = sig.value; break }
    }
    depth--
    return result
  }

  // ── Statement runner ─────────────────────────────────────────────────────

  async function runStmt(
    stmt: Stmt,
    scope: Record<string, UrduValue>,
  ): Promise<ReturnSignal | void> {
    if (isCancelled?.()) throw new CancelledError()
    switch (stmt.type) {
      case 'FuncDecl': {
        funcs.set(stmt.name, stmt)
        break
      }

      case 'ClassDecl': {
        classes.set(stmt.name, stmt)
        break
      }

      case 'VarDecl': {
        scope[stmt.name] = await evalExpr(stmt.value, scope)
        break
      }

      case 'Assign': {
        if (stmt.name in scope) {
          scope[stmt.name] = await evalExpr(stmt.value, scope)
        } else if (stmt.name in globalScope) {
          globalScope[stmt.name] = await evalExpr(stmt.value, scope)
        } else {
          throw new RuntimeError(`"${stmt.name}" موجود نہیں — پہلے رکھو سے بنائیں`)
        }
        break
      }

      case 'MemberAssign': {
        const obj = await evalExpr(stmt.object, scope)
        if (!isObject(obj)) throw new RuntimeError(`"${stmt.property}" صرف اشیاء پر لگتا ہے`)
        obj.fields[stmt.property] = await evalExpr(stmt.value, scope)
        break
      }

      case 'Print': {
        io.print(display(await evalExpr(stmt.value, scope)))
        break
      }

      case 'While': {
        while (true) {
          const cond = await evalExpr(stmt.condition, scope)
          if (typeof cond !== 'boolean') throw new RuntimeError('جب کی شرط سچ یا جھوٹ ہونی چاہیے')
          if (!cond) break
          if (isCancelled?.()) throw new CancelledError()
          if (++steps > MAX_STEPS) throw new RuntimeError('لوپ بہت لمبا چلا — دس ہزار مرحلے مکمل')
          for (const s of stmt.body) {
            const sig = await runStmt(s, scope)
            if (sig instanceof ReturnSignal) return sig
          }
        }
        break
      }

      case 'If': {
        const cond = await evalExpr(stmt.condition, scope)
        if (typeof cond !== 'boolean') throw new RuntimeError('اگر کی شرط سچ یا جھوٹ ہونی چاہیے')
        const branch = cond ? stmt.consequent : (stmt.alternate ?? [])
        for (const s of branch) {
          const sig = await runStmt(s, scope)
          if (sig instanceof ReturnSignal) return sig
        }
        break
      }

      case 'Return': {
        const val = stmt.value !== null ? await evalExpr(stmt.value, scope) : null
        return new ReturnSignal(val)
      }

      case 'CallStmt': {
        const decl = funcs.get(stmt.name)
        if (!decl) throw new RuntimeError(`"${stmt.name}" کوئی فنکشن نہیں`)
        const args = await evalArgs(stmt.args, scope)
        await callFunction(decl, args)
        break
      }

      case 'MethodCallStmt': {
        const obj = await evalExpr(stmt.object, scope)
        if (isList(obj)) {
          const args = await evalArgs(stmt.args, scope)
          callListMethod(obj, stmt.method, args)
          break
        }
        if (!isObject(obj)) throw new RuntimeError(`"${stmt.method}" صرف اشیاء پر کام کرتا ہے`)
        const method = obj.methods.get(stmt.method)
        if (!method) throw new RuntimeError(`"${stmt.method}" — "${obj.className}" میں کوئی طریقہ نہیں`)
        const args = await evalArgs(stmt.args, scope)
        await callMethod(obj, method, args)
        break
      }

      case 'IndexAssign': {
        const list = stmt.name in scope ? scope[stmt.name] : globalScope[stmt.name]
        if (list === undefined) throw new RuntimeError(`"${stmt.name}" موجود نہیں`)
        if (!isList(list)) throw new RuntimeError(`"${stmt.name}" فہرست نہیں ہے`)
        const idx = await evalExpr(stmt.index, scope)
        if (typeof idx !== 'number') throw new RuntimeError('اشاریہ عدد ہونا چاہیے')
        const i = Math.floor(idx)
        if (i < 0 || i >= list.items.length) throw new RuntimeError(`اشاریہ ${i} حد سے باہر ہے`)
        list.items[i] = await evalExpr(stmt.value, scope)
        break
      }
    }
  }

  // ── Expression evaluator ─────────────────────────────────────────────────

  async function evalArgs(exprs: Expr[], scope: Record<string, UrduValue>): Promise<UrduValue[]> {
    const result: UrduValue[] = []
    for (const e of exprs) result.push(await evalExpr(e, scope))
    return result
  }

  async function evalExpr(expr: Expr, scope: Record<string, UrduValue>): Promise<UrduValue> {
    switch (expr.type) {
      case 'Number': return expr.value
      case 'String': return expr.value
      case 'Bool':   return expr.value

      case 'This': {
        const self = scope['یہ']
        if (self === undefined) throw new RuntimeError('"یہ" صرف طریقے کے اندر کام آتا ہے')
        return self
      }

      case 'Input': {
        const raw = await io.input()
        const n = Number(raw)
        return raw.trim() !== '' && !isNaN(n) ? n : raw
      }

      case 'Ident': {
        if (expr.name in scope) return scope[expr.name] as UrduValue
        if (expr.name in globalScope) return globalScope[expr.name] as UrduValue
        throw new RuntimeError(`"${expr.name}" موجود نہیں`)
      }

      case 'Unary': {
        const val = await evalExpr(expr.operand, scope)
        if (typeof val !== 'number') throw new RuntimeError('منفی صرف عدد پر لگ سکتا ہے')
        return -val
      }

      case 'Binary': {
        const left  = await evalExpr(expr.left, scope)
        const right = await evalExpr(expr.right, scope)
        return applyOp(expr.op, left, right)
      }

      case 'Call': {
        const decl = funcs.get(expr.name)
        if (!decl) throw new RuntimeError(`"${expr.name}" کوئی فنکشن نہیں`)
        const args = await evalArgs(expr.args, scope)
        return (await callFunction(decl, args)) ?? 0
      }

      case 'New': {
        const classDecl = classes.get(expr.className)
        if (!classDecl) throw new RuntimeError(`"${expr.className}" کوئی قسم نہیں`)
        const args = await evalArgs(expr.args, scope)

        const instance: UrduObject = {
          className: expr.className,
          fields: {},
          methods: new Map(),
        }

        // Register methods from class body
        for (const s of classDecl.body) {
          if (s.type === 'FuncDecl') instance.methods.set(s.name, s)
        }

        // Bind constructor params as fields
        for (let i = 0; i < classDecl.params.length; i++) {
          instance.fields[classDecl.params[i] ?? ''] = args[i] ?? 0
        }

        // Run non-method constructor body with یہ bound
        const ctorScope: Record<string, UrduValue> = { 'یہ': instance }
        for (const s of classDecl.body) {
          if (s.type === 'FuncDecl') continue
          const sig = await runStmt(s, ctorScope)
          if (sig instanceof ReturnSignal) break
        }

        return instance
      }

      case 'Member': {
        const obj = await evalExpr(expr.object, scope)
        if (!isObject(obj)) throw new RuntimeError(`"${expr.property}" صرف اشیاء پر کام کرتا ہے`)
        if (!(expr.property in obj.fields)) {
          throw new RuntimeError(`"${expr.property}" — "${obj.className}" میں موجود نہیں`)
        }
        return obj.fields[expr.property] as UrduValue
      }

      case 'MethodCall': {
        const obj = await evalExpr(expr.object, scope)
        if (isList(obj)) {
          const args = await evalArgs(expr.args, scope)
          return callListMethod(obj, expr.method, args)
        }
        if (!isObject(obj)) throw new RuntimeError(`"${expr.method}" صرف اشیاء پر کام کرتا ہے`)
        const method = obj.methods.get(expr.method)
        if (!method) throw new RuntimeError(`"${expr.method}" — "${obj.className}" میں کوئی طریقہ نہیں`)
        const args = await evalArgs(expr.args, scope)
        return (await callMethod(obj, method, args)) ?? 0
      }

      case 'List': {
        const items: UrduValue[] = []
        for (const item of expr.items) items.push(await evalExpr(item, scope))
        return { items }
      }

      case 'Index': {
        const obj = await evalExpr(expr.object, scope)
        if (!isList(obj)) throw new RuntimeError('صرف فہرست پر [] کام کرتا ہے')
        const idx = await evalExpr(expr.index, scope)
        if (typeof idx !== 'number') throw new RuntimeError('اشاریہ عدد ہونا چاہیے')
        const i = Math.floor(idx)
        if (i < 0 || i >= obj.items.length) throw new RuntimeError(`اشاریہ ${i} حد سے باہر ہے`)
        return obj.items[i]!
      }
    }
  }
}

function applyOp(
  op: '+' | '-' | '*' | '/' | '==' | '!=' | '>=' | '<=' | '>' | '<',
  left: UrduValue,
  right: UrduValue,
): UrduValue {
  switch (op) {
    case '+':
      if (typeof left === 'number' && typeof right === 'number') return left + right
      if (typeof left === 'string' && typeof right === 'string') return left + right
      if (typeof left === 'string') return left + display(right)
      if (typeof right === 'string') return display(left) + right
      throw new RuntimeError('+ کے لیے دونوں طرف ایک ہی قسم ہونی چاہیے')

    case '-':
      if (typeof left === 'number' && typeof right === 'number') return left - right
      throw new RuntimeError('- صرف عدد پر کام کرتا ہے')

    case '*':
      if (typeof left === 'number' && typeof right === 'number') return left * right
      throw new RuntimeError('* صرف عدد پر کام کرتا ہے')

    case '/':
      if (typeof left === 'number' && typeof right === 'number') {
        if (right === 0) throw new RuntimeError('صفر سے تقسیم نہیں ہو سکتی')
        return left / right
      }
      throw new RuntimeError('/ صرف عدد پر کام کرتا ہے')

    case '==': return left === right
    case '!=': return left !== right

    case '>=':
    case '<=':
    case '>':
    case '<': {
      if (typeof left === 'number' && typeof right === 'number') {
        if (op === '>=') return left >= right
        if (op === '<=') return left <= right
        if (op === '>')  return left > right
        return left < right
      }
      if (typeof left === 'string' && typeof right === 'string') {
        if (op === '>=') return left >= right
        if (op === '<=') return left <= right
        if (op === '>')  return left > right
        return left < right
      }
      throw new RuntimeError(`"${op}" کے لیے دونوں طرف ایک ہی قسم ہونی چاہیے`)
    }
  }
}

function callListMethod(list: UrduList, method: string, args: UrduValue[]): UrduValue {
  switch (method) {
    case 'شامل': {
      if (args.length !== 1) throw new RuntimeError('"شامل" کو ایک قدر چاہیے')
      list.items.push(args[0]!)
      return 0
    }
    case 'نکالو': {
      if (list.items.length === 0) throw new RuntimeError('فہرست خالی ہے — نکالو ناممکن')
      return list.items.pop()!
    }
    case 'آگے': {
      if (list.items.length === 0) throw new RuntimeError('فہرست خالی ہے — آگے ناممکن')
      return list.items.shift()!
    }
    case 'لمبائی': {
      return list.items.length
    }
    default:
      throw new RuntimeError(`"${method}" — فہرست میں کوئی طریقہ نہیں`)
  }
}

function display(val: UrduValue): string {
  if (typeof val === 'boolean') return val ? 'سچ' : 'جھوٹ'
  if (isList(val)) return `[${val.items.map(display).join(', ')}]`
  if (isObject(val)) return `[${val.className}]`
  return String(val)
}
