/*
gqodegen : GraphQL to TS made clear, direct and simple

- Roles of types:
  - data model definition
  - query definition
  - input data definitions
  - then Data resolvers

2 kinds of directive :
- schema modifiers
- and runtime functions (transformers, hash, rules, etc)
*/

import "std/dotenv/load.ts";
import {
  parse,
  buildASTSchema,
  defaultFieldResolver,
  DefinitionNode,
  DirectiveDefinitionNode,
  DirectiveNode,
  DocumentNode,
  GraphQLSchema,
  Kind,
  NamedTypeNode,
  NameNode,
  ObjectTypeDefinitionNode,
  print,
  specifiedRules,
  TypeInfo,
  visitWithTypeInfo,
  validate,
  visit,
TypeSystemDefinitionNode,
ListTypeNode,
InputValueDefinitionNode,
TypeNode,
NonNullTypeNode,
ValueNode,
FieldDefinitionNode,
ValidationRule,
ValidationContext,
ASTNode,
ObjectTypeExtensionNode,
InputObjectTypeDefinitionNode
} from "graphql";

import {str, Dict} from "./types.ts"

import { mapSchema, MapperKind, getDirectives } from 'graphql-tools/utils/index.ts'

let errors = null

const isoDate=(d:Date):string=>d.getDate()  + "-"
+ (d.getMonth()+1) + "-" + d.getFullYear() + " "
+ d.getHours().toString().padStart(2,'0') + ":" + d.getMinutes().toString().padStart(2,'0');

const filename = Deno.env.get("SOURCE") || "test.gql"
const file = await Deno.readTextFile(filename);

console.log("building AST",filename)
const ast:DocumentNode = parse(file),
      schema:GraphQLSchema = buildASTSchema(ast),
      typeinfo:TypeInfo = new TypeInfo(schema);

const vc = new ValidationContext(
        schema,ast,typeinfo,(err)=>console.log(err))

errors = validate(schema, ast, undefined, typeinfo)
if(errors) console.log(errors[0])

console.log("Augmenting schema")

const typeMap=(s:string)=>({
  "String":"string"

})[s]||s

// storage for the examinated types
const scalars:Array<string> = [],
      enums:Dict<Array<string>> = {},
      directiveMap = {
        // todo
      }


function argumentList<T>(a: ReadonlyArray<T>, fn:(v:T)=>string ):string {
  // turns an array into it's string-coma-separated-list representation
  return a.map((v:T)=>fn(v)).join(", ")
}

function nestList(a:TypeNode):string {
  // forget about optionnal types for now
  switch(a.kind) {
    case "ListType"   : return `Array<${nestList(a.type)}>`
    case "NonNullType": return `${nestList(a.type)}`
    case "NamedType"  : return `${typeMap(a.name.value)}`
  }
}

function nestDefaultValue(a:ValueNode|undefined):string {
  /* Values aren't checked against the declared types
     they will be at compile time
     values can exist on their own or be array of [other type]
     hence the "nest" which stands for "nested"
     */
  if (a==undefined) return ""
  switch(a.kind) {
    case "ListValue"   :
      return `[${argumentList(a.values,nestDefaultValue)}]`
    case "ObjectValue" :
      return `{${a.fields.map(f=>
        `${f.name.value}:${nestDefaultValue(f.value)}`)}}`
    case "IntValue"    :
    case "FloatValue"  :
    case "BooleanValue": return a.value.toString()
    case "StringValue" : return `"${a.value}"`
    case "NullValue"   : return "null"
    case "Variable"    : return a.name.value
    default: console.log(a.kind); return "Error"
  }
}


const interfaceObject=(node:ObjectTypeDefinitionNode):string=>
  node.description ?`// ${node.description.value}\n`:''
  + `export type ${node.name.value} = {`
  + node.fields?.map(f=>`
  ${typedef(f)}`)
  +'\n}\n'

const interfaceInputObject=(node:InputObjectTypeDefinitionNode):string=>
  (node.description ?`// ${node.description.value}\n`:'')
  + `export type ${node.name.value} = {`
  + node.fields?.map(f=>`
  ${inputTypedef(f)}`)
  +'\n}\n'

const functionHeader=(f:FieldDefinitionNode, defaults=false)=>
  `export function ${f.name.value}`
    + (f.arguments && " ("
      + f.arguments?.map(a=>
        `${a.name.value} : ${nestList(a.type)}`
        + ((defaults && a.defaultValue) ? "="+nestDefaultValue(a.defaultValue):'')
        ).join(", ") + ") : "
      ) + typeMap(nestList(f.type))


/**
 *
we are probably not going to have
types that returns functions
but rather fields that are queried like so.
This is valid on the GQL/TS side
but not as a "real" return type
(eg the object is returned, but not
  a function definition inside it)

  TODO: state on this according to filters
*/

const isFunction =(f:FieldDefinitionNode):boolean=>
(f.arguments!=undefined && f.arguments.length>0)
const functionParameters =(f:FieldDefinitionNode):str=>
      " ("
      + f.arguments?.map(a=>
          `${a.name.value} : ${nestList(a.type)}`
          + (a.defaultValue ? "="+nestDefaultValue(a.defaultValue):'')
        ).join(", ") + ")"

const typedef =(f:FieldDefinitionNode):str=>
   `${isFunction(f) ? "function ":''} ${f.name.value}`
  +`${isFunction(f) ? functionParameters(f) : ""}: `
  + typeMap(nestList(f.type))

const inputTypedef =(f:InputValueDefinitionNode):str=>
  f.name.value + ": "
  + typeMap(nestList(f.type))
  // Interfaces have no initializers. This goes elesewhere
  + (f.defaultValue ? " //="+nestDefaultValue(f.defaultValue):'')


let header = `/*
* CodeGen :: GraphQL to TS
* Generated on ${isoDate(new Date())}
*/
`

// interface works as well
type ReturnTypeByInputType = {
  int: number
  char: string
  bool: boolean
}

interface INodeProcessor {
  process(node:ASTNode):string
}

function process(node:ObjectTypeDefinitionNode) {
  return "obj"
}

class NodeProcessor{
  process(node:ASTNode) {
    return "ok"
  }
}

class ObjectTypeDefinitionProcessor extends NodeProcessor {
  process(node:ObjectTypeDefinitionNode) {
    return "ok"
  }
}

schema.getQueryType()?.astNode?.fields?.map(f=>process(f))

const ext = schema.getQueryType()?.extensionASTNodes

console.log(ext?.map(f=>f.fields?.map(f=>f.name.value)))

let types = ""
let functions = ""

const editedAST = visit(ast, {
/*
  tried to get a pure function,
  but the visitFn typesystem isn't easy
*/

  ScalarTypeDefinition(node) {
    //console.log("scalar:", node.name.value)
    scalars.push(typeMap(node.name.value))
    //undefined
  },

  EnumTypeDefinition(node) {
    //console.log("enum")
    enums[node.name.value] = node.values?.map(x=>x.name.value) || []
    //undefined
  },

  OperationDefinition(node) {
    console.log("operation")
    console.log(node)
    undefined
  },


  ObjectTypeDefinition(node:ObjectTypeDefinitionNode) {
    switch (node.name.value) {
      case "Query" :
        functions +=
        node.fields?.map(f=>functionHeader(f)).join("\n")+'\n'; break
      case "Mutation" :
        functions +=
        node.fields?.map(f=>functionHeader(f)).join("\n")+'\n'; break
      default :
        types += interfaceObject(node)
    }
  },

  // the extension of query and mutations allow specific directives applied
  // to a set (eg. middlewares)
  // same as above + extension rule applies only to query and mutation
  ObjectTypeExtension(node:ObjectTypeExtensionNode) {
    switch (node.name.value) {
      case "Query" :
        functions +=
        node.fields?.map(
          f=>functionHeader(f)).join("\n")+'\n'; break
      case "Mutation" :
        functions +=
        node.fields?.map(f=>functionHeader(f)).join("\n")+'\n'; break
      default :
        throw new Error(
          `extented ${node.name.value}. Why ?`
          + `\nat ${filename}:${node.loc?.startToken.line}.`
          + " Not supposed to.")
    }
  },

  InputObjectTypeDefinition(node): void {
    types += interfaceInputObject(node)
  }
})


export const authDirectiveTransformer = (schema: GraphQLSchema) =>
  mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (config) => {
      const directives = getDirectives(schema, config)
      if (directives['auth']) {
        const { resolve = defaultFieldResolver } = config
        config.description = [config.description]
          .concat('Must be authenticated')
          .filter((v) => v)
          .join('\n')
        config.resolve = async function (p: any, a: any, c: any, i: any) {
          if (!c.userId) throw new Error('Must be authenticated')
          return await resolve(p, a, c, i)
        }
        return config
      }
      return config
    },
  })


const augmentedSchema:GraphQLSchema = buildASTSchema(ast)
/*console.log("validating augmented schema")
errors = validate(schema,ast)
if(errors) console.log(errors[0])*/


function generate():string {
  return `
${header}
//⬛ scalars
import { ${scalars.join(", ")}, Int } from "./${Deno.env.get("SCALARS") || "types.ts"}"
//⬛ enums
`+ Object.keys(enums).map(x=>
`enum ${x} { ${enums[x].join(", ")} }`).join("\n")
 +`
//   enum strings
`+ Object.keys(enums).map(x=>
`type ${x}String = ["${enums[x].join("\", \"")}"]`).join("\n")
+`
//⬛ types
`+ types
+`
//⬛ query headers
`+ functions
}

const sources = generate()
console.log(sources)
const sourcefile = Deno.env.get("OUTPUT") || "generated.ts"
await Deno.writeTextFile(sourcefile, sources)
const cmd = ["deno", "compile", sourcefile]

console.log("• Compiling generated source •\n")
const p = Deno.run({ cmd });
console.log(await p.status());
