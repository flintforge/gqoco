import {ObjectId} from "mongo";
export type ID = ObjectId

export class Email{
  value:string
  constructor(value:string){
    if (Email.check(value)) {
      this.value = value
    } else {
      throw new Error("invalid email")
    }
  }
  static check(value:string):boolean {
    return true // regex check
  }
}

//export type Email = string
//export type ObjectId = string
export type Dict<V=string> = {[key:string]:V}
export type ScalarMapping = Dict
export type Resolvers = Dict<(a:string)=>string>
export type Int = number
export type int = Int
export type Float = number
export type float = Float
export type str = string


