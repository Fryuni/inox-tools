/*
 * Based on:
 * https://github.com/pulumi/pulumi/blob/035a502d86403d815059615a9c047ccccc2cbdd5/sdk/nodejs/runtime/closure/createClosure.ts#L29-L94
 */

import type { Entry } from "./entry.js";

/** @internal */
export interface InspectedObject {
    // information about the prototype of this object/function.  If this is an object, we only store
    // this if the object's prototype is not Object.prototype.  If this is a function, we only store
    // this if the function's prototype is not Function.prototype.
    proto?: Entry;

    // information about the properties of the object.  We store all properties of the object,
    // regardless of whether they have string or symbol names.
    env: PropertyMap;
}

// Information about a javascript function.  Note that this derives from ObjectInfo as all functions
// are objects in JS, and thus can have their own proto and properties.
/** @internal */
export interface InspectedFunction extends InspectedObject {
    // a serialization of the function's source code as text.
    code: string;

    // the captured lexical environment of names to values, if any.
    capturedValues: PropertyMap;

    // Whether or not the real 'this' (i.e. not a lexically captured this) is used in the function.
    usesNonLexicalThis: boolean;

    // name that the function was declared with.  used only for trying to emit a better
    // name into the serialized code for it.
    name: string | undefined;

    // Number of parameters this function is declared to take.  Used to generate a serialized
    // function with the same number of parameters.  This is valuable as some 3rd party libraries
    // (like senchalabs: https://github.com/senchalabs/connect/blob/fa8916e6350e01262e86ccee82f490c65e04c728/index.js#L232-L241)
    // will introspect function param count to decide what to do.
    paramCount: number;
}

// Similar to PropertyDescriptor.  Helps describe an Entry in the case where it is not
// simple.
/** @internal */
export interface PropertyInfo {
    // If the property has a value we should directly provide when calling .defineProperty
    hasValue: boolean;

    // same as PropertyDescriptor
    configurable?: boolean;
    enumerable?: boolean;
    writable?: boolean;

    // The entries we've made for custom getters/setters if the property is defined that
    // way.
    get?: Entry;
    set?: Entry;
}

// Information about a property.  Specifically the actual entry containing the data about it and
// then an optional PropertyInfo in the case that this isn't just a common property.
/** @internal */
export interface PropertyInfoAndValue {
    info?: PropertyInfo;
    entry: Entry;
}

// A mapping between the name of a property (symbolic or string) to information about the
// value for that property.
/** @internal */
export type PropertyMap = Map<Entry, PropertyInfoAndValue>;

export namespace InspectedFunction {
  export function isSimple(info: InspectedFunction) {
    return info.capturedValues.size === 0 && info.env.size === 0 && !info.proto;
  }
}
