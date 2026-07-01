import { type Token, type TokenType } from './lexer'

// ── AST node types ──────────────────────────────────────────────────────────

export type Stmt =
  | VarDeclStmt
  | AssignStmt
  | PrintStmt
  | IfStmt
  | WhileStmt
  | FuncDeclStmt
  | ReturnStmt
  | CallStmt
  | ClassDeclStmt
  | MemberAssignStmt
  | MethodCallStmt
  | IndexAssignStmt

export interface VarDeclStmt   { type: 'VarDecl';      name: string; value: Expr }
export interface AssignStmt    { type: 'Assign';       name: string; value: Expr }
export interface PrintStmt     { type: 'Print';        value: Expr }
export interface ReturnStmt    { type: 'Return';       value: Expr | null }
export interface CallStmt      { type: 'CallStmt';     name: string; args: Expr[] }
export interface ClassDeclStmt { type: 'ClassDecl';    name: string; params: string[]; body: Stmt[] }
export interface MemberAssignStmt { type: 'MemberAssign'; object: Expr; property: string; value: Expr }
export interface MethodCallStmt   { type: 'MethodCallStmt'; object: Expr; method: string; args: Expr[] }
export interface IndexAssignStmt  { type: 'IndexAssign';    name: string; index: Expr; value: Expr }
export interface IfStmt {
  type: 'If'
  condition: Expr
  consequent: Stmt[]
  alternate: Stmt[] | null
}
export interface WhileStmt {
  type: 'While'
  condition: Expr
  body: Stmt[]
}
export interface FuncDeclStmt {
  type: 'FuncDecl'
  name: string
  params: string[]
  body: Stmt[]
}

export type Expr =
  | NumberExpr
  | StringExpr
  | BoolExpr
  | InputExpr
  | IdentExpr
  | UnaryExpr
  | BinaryExpr
  | CallExpr
  | NewExpr
  | MemberExpr
  | MethodCallExpr
  | ThisExpr
  | ListExpr
  | IndexExpr

export interface NumberExpr    { type: 'Number'; value: number }
export interface StringExpr    { type: 'String'; value: string }
export interface BoolExpr      { type: 'Bool';   value: boolean }
export interface InputExpr     { type: 'Input' }
export interface IdentExpr     { type: 'Ident';  name: string }
export interface UnaryExpr     { type: 'Unary';  op: '-'; operand: Expr }
export interface ThisExpr      { type: 'This' }
export interface NewExpr       { type: 'New';    className: string; args: Expr[] }
export interface MemberExpr    { type: 'Member'; object: Expr; property: string }
export interface MethodCallExpr { type: 'MethodCall'; object: Expr; method: string; args: Expr[] }
export interface BinaryExpr {
  type: 'Binary'
  op: '+' | '-' | '*' | '/' | '==' | '!=' | '>=' | '<=' | '>' | '<'
  left: Expr
  right: Expr
}
export interface CallExpr  { type: 'Call';  name: string; args: Expr[] }
export interface ListExpr  { type: 'List';  items: Expr[] }
export interface IndexExpr { type: 'Index'; object: Expr; index: Expr }

export interface Program { stmts: Stmt[] }

// ── Parser ───────────────────────────────────────────────────────────────────

export class ParseError extends Error {
  constructor(msg: string, public line: number) {
    super(msg)
    this.name = 'ParseError'
  }
}

class Parser {
  private pos = 0

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos] ?? { type: 'EOF', value: '', line: -1 }
  }

  private advance(): Token {
    const tok = this.peek()
    this.pos++
    return tok
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type
  }

  private consumeIf(type: TokenType): void {
    if (this.check(type)) this.advance()
  }

  private expect(type: TokenType): Token {
    const tok = this.peek()
    if (tok.type !== type) {
      throw new ParseError(`"${tok.value}" غیر متوقع ہے`, tok.line)
    }
    return this.advance()
  }

  // ── Public entry ──────────────────────────────────────────────────────────

  parse(): Program {
    const stmts: Stmt[] = []
    while (!this.check('EOF')) {
      if (this.check('SEMICOLON')) { this.advance(); continue }
      stmts.push(this.parseStmt())
    }
    return { stmts }
  }

  // ── Statements ────────────────────────────────────────────────────────────

  private parseStmt(): Stmt {
    const tok = this.peek()
    switch (tok.type) {
      case 'RAKHO':      return this.parseVarDecl()
      case 'LIKHO':      return this.parsePrint()
      case 'AGAR':       return this.parseIf()
      case 'JAB':        return this.parseWhile()
      case 'KAM':        return this.parseFuncDecl()
      case 'WAPAS':      return this.parseReturn()
      case 'QISM':       return this.parseClassDecl()
      case 'YEH':        return this.parseYehStmt()
      case 'IDENTIFIER': return this.parseIdentStmt()
      default:
        throw new ParseError(`"${tok.value}" یہاں نہیں آ سکتا`, tok.line)
    }
  }

  private parseVarDecl(): VarDeclStmt {
    this.expect('RAKHO')
    const name = this.expect('IDENTIFIER').value
    this.expect('ASSIGN')
    const value = this.parseExpr()
    this.consumeIf('SEMICOLON')
    return { type: 'VarDecl', name, value }
  }

  private parsePrint(): PrintStmt {
    this.expect('LIKHO')
    this.expect('LPAREN')
    const value = this.parseExpr()
    this.expect('RPAREN')
    this.consumeIf('SEMICOLON')
    return { type: 'Print', value }
  }

  private parseIf(): IfStmt {
    this.expect('AGAR')
    this.expect('LPAREN')
    const condition = this.parseExpr()
    this.expect('RPAREN')
    const consequent = this.parseBlock()
    const alternate = this.check('WARNA') ? (this.advance(), this.parseBlock()) : null
    return { type: 'If', condition, consequent, alternate }
  }

  private parseWhile(): WhileStmt {
    this.expect('JAB')
    this.expect('LPAREN')
    const condition = this.parseExpr()
    this.expect('RPAREN')
    const body = this.parseBlock()
    return { type: 'While', condition, body }
  }

  private parseFuncDecl(): FuncDeclStmt {
    this.expect('KAM')
    const name = this.expect('IDENTIFIER').value
    this.expect('LPAREN')
    const params: string[] = []
    if (!this.check('RPAREN')) {
      params.push(this.expect('IDENTIFIER').value)
      while (this.check('COMMA')) {
        this.advance()
        params.push(this.expect('IDENTIFIER').value)
      }
    }
    this.expect('RPAREN')
    const body = this.parseBlock()
    return { type: 'FuncDecl', name, params, body }
  }

  private parseReturn(): ReturnStmt {
    this.expect('WAPAS')
    if (this.check('RBRACE') || this.check('SEMICOLON') || this.check('EOF')) {
      this.consumeIf('SEMICOLON')
      return { type: 'Return', value: null }
    }
    const value = this.parseExpr()
    this.consumeIf('SEMICOLON')
    return { type: 'Return', value }
  }

  private parseClassDecl(): ClassDeclStmt {
    this.expect('QISM')
    const name = this.expect('IDENTIFIER').value
    this.expect('LPAREN')
    const params: string[] = []
    if (!this.check('RPAREN')) {
      params.push(this.expect('IDENTIFIER').value)
      while (this.check('COMMA')) {
        this.advance()
        params.push(this.expect('IDENTIFIER').value)
      }
    }
    this.expect('RPAREN')
    const body = this.parseBlock()
    return { type: 'ClassDecl', name, params, body }
  }

  // Statements starting with یہ: یہ.prop = expr  or  یہ.method(args)
  private parseYehStmt(): Stmt {
    this.expect('YEH')
    let obj: Expr = { type: 'This' }

    while (true) {
      this.expect('DOT')
      const member = this.expect('IDENTIFIER').value

      if (this.check('LPAREN')) {
        const args = this.parseArgList()
        if (this.check('DOT')) {
          // chained call: یہ.a().b() — treat this call as an expression and continue
          obj = { type: 'MethodCall', object: obj, method: member, args }
          continue
        }
        this.consumeIf('SEMICOLON')
        return { type: 'MethodCallStmt', object: obj, method: member, args }
      }

      if (this.check('ASSIGN')) {
        this.advance()
        const value = this.parseExpr()
        this.consumeIf('SEMICOLON')
        return { type: 'MemberAssign', object: obj, property: member, value }
      }

      // Neither call nor assign — must be chaining to another dot
      obj = { type: 'Member', object: obj, property: member }
      if (!this.check('DOT')) {
        throw new ParseError('"." کے بعد "=" یا "()" چاہیے', this.peek().line)
      }
    }
  }

  // Statements starting with IDENTIFIER: call, assign, or member-assign/call
  private parseIdentStmt(): Stmt {
    const nameTok = this.expect('IDENTIFIER')

    if (this.check('DOT')) {
      let obj: Expr = { type: 'Ident', name: nameTok.value }

      while (this.check('DOT')) {
        this.advance()
        const member = this.expect('IDENTIFIER').value

        if (this.check('LPAREN')) {
          const args = this.parseArgList()
          if (this.check('DOT')) {
            obj = { type: 'MethodCall', object: obj, method: member, args }
            continue
          }
          this.consumeIf('SEMICOLON')
          return { type: 'MethodCallStmt', object: obj, method: member, args }
        }

        if (this.check('ASSIGN')) {
          this.advance()
          const value = this.parseExpr()
          this.consumeIf('SEMICOLON')
          return { type: 'MemberAssign', object: obj, property: member, value }
        }

        obj = { type: 'Member', object: obj, property: member }
      }

      throw new ParseError('"." کے بعد "=" یا "()" چاہیے', this.peek().line)
    }

    if (this.check('LPAREN')) {
      const args = this.parseArgList()
      this.consumeIf('SEMICOLON')
      return { type: 'CallStmt', name: nameTok.value, args }
    }

    if (this.check('LBRACKET')) {
      this.advance()
      const index = this.parseExpr()
      this.expect('RBRACKET')
      this.expect('ASSIGN')
      const value = this.parseExpr()
      this.consumeIf('SEMICOLON')
      return { type: 'IndexAssign', name: nameTok.value, index, value }
    }

    this.expect('ASSIGN')
    const value = this.parseExpr()
    this.consumeIf('SEMICOLON')
    return { type: 'Assign', name: nameTok.value, value }
  }

  private parseBlock(): Stmt[] {
    this.expect('LBRACE')
    const stmts: Stmt[] = []
    while (!this.check('RBRACE') && !this.check('EOF')) {
      if (this.check('SEMICOLON')) { this.advance(); continue }
      stmts.push(this.parseStmt())
    }
    this.expect('RBRACE')
    return stmts
  }

  // ── Argument list ─────────────────────────────────────────────────────────

  private parseArgList(): Expr[] {
    this.expect('LPAREN')
    const args: Expr[] = []
    if (!this.check('RPAREN')) {
      args.push(this.parseExpr())
      while (this.check('COMMA')) {
        this.advance()
        args.push(this.parseExpr())
      }
    }
    this.expect('RPAREN')
    return args
  }

  // ── Expressions ───────────────────────────────────────────────────────────
  //
  //   comparison → addSub (compOp addSub)*
  //   addSub     → mulDiv (('+' | '-') mulDiv)*
  //   mulDiv     → unary  (('*' | '/') unary)*
  //   unary      → '-' unary | postfix
  //   postfix    → primary ('.' IDENTIFIER ['(' args ')'])*
  //   primary    → NUMBER | STRING | SACH | JHOOT | PARHO() | YEH | NAYA ident(args)
  //              | IDENT ['(' args ')'] | '(' expr ')'

  private parseExpr(): Expr { return this.parseComparison() }

  private parseComparison(): Expr {
    let left = this.parseAddSub()
    while (true) {
      const { type } = this.peek()
      if (type !== 'EQ' && type !== 'NEQ' && type !== 'GTE' && type !== 'LTE' && type !== 'GT' && type !== 'LT') break
      const op = this.advance().value as BinaryExpr['op']
      left = { type: 'Binary', op, left, right: this.parseAddSub() }
    }
    return left
  }

  private parseAddSub(): Expr {
    let left = this.parseMulDiv()
    while (this.check('PLUS') || this.check('MINUS')) {
      const op = this.advance().value as '+' | '-'
      left = { type: 'Binary', op, left, right: this.parseMulDiv() }
    }
    return left
  }

  private parseMulDiv(): Expr {
    let left = this.parseUnary()
    while (this.check('STAR') || this.check('SLASH')) {
      const op = this.advance().value as '*' | '/'
      left = { type: 'Binary', op, left, right: this.parseUnary() }
    }
    return left
  }

  private parseUnary(): Expr {
    if (this.check('MINUS')) {
      this.advance()
      const operand = this.parseUnary()
      if (operand.type === 'Number') return { type: 'Number', value: -operand.value }
      return { type: 'Unary', op: '-', operand }
    }
    return this.parsePostfix()
  }

  // Handle dot chaining and index access in expressions
  private parsePostfix(): Expr {
    let expr = this.parsePrimary()
    while (this.check('DOT') || this.check('LBRACKET')) {
      if (this.check('LBRACKET')) {
        this.advance()
        const index = this.parseExpr()
        this.expect('RBRACKET')
        expr = { type: 'Index', object: expr, index }
      } else {
        this.advance()
        const member = this.expect('IDENTIFIER').value
        if (this.check('LPAREN')) {
          const args = this.parseArgList()
          expr = { type: 'MethodCall', object: expr, method: member, args }
        } else {
          expr = { type: 'Member', object: expr, property: member }
        }
      }
    }
    return expr
  }

  private parsePrimary(): Expr {
    const tok = this.peek()

    if (tok.type === 'NUMBER') {
      this.advance()
      return { type: 'Number', value: Number(tok.value) }
    }

    if (tok.type === 'STRING') {
      this.advance()
      return { type: 'String', value: tok.value }
    }

    if (tok.type === 'SACH')  { this.advance(); return { type: 'Bool', value: true } }
    if (tok.type === 'JHOOT') { this.advance(); return { type: 'Bool', value: false } }

    if (tok.type === 'YEH') {
      this.advance()
      return { type: 'This' }
    }

    if (tok.type === 'NAYA') {
      this.advance()
      const className = this.expect('IDENTIFIER').value
      const args = this.parseArgList()
      return { type: 'New', className, args }
    }

    if (tok.type === 'PARHO') {
      this.advance()
      this.expect('LPAREN')
      this.expect('RPAREN')
      return { type: 'Input' }
    }

    if (tok.type === 'IDENTIFIER') {
      this.advance()
      if (this.check('LPAREN')) {
        const args = this.parseArgList()
        return { type: 'Call', name: tok.value, args }
      }
      return { type: 'Ident', name: tok.value }
    }

    if (tok.type === 'LBRACKET') {
      this.advance()
      const items: Expr[] = []
      if (!this.check('RBRACKET')) {
        items.push(this.parseExpr())
        while (this.check('COMMA')) {
          this.advance()
          items.push(this.parseExpr())
        }
      }
      this.expect('RBRACKET')
      return { type: 'List', items }
    }

    if (tok.type === 'LPAREN') {
      this.advance()
      const expr = this.parseExpr()
      this.expect('RPAREN')
      return expr
    }

    throw new ParseError(`"${tok.value}" کوئی قدر نہیں ہے`, tok.line)
  }
}

export function parse(tokens: Token[]): Program {
  return new Parser(tokens).parse()
}
