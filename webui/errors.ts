type ErrorValue = string | [string] | ServerError;
type ServerError = { [field: string]: ErrorValue; };

export class Errors {
	#error: ServerError;

	constructor(error: ErrorValue){
		if(typeof error === "string" || Array.isArray(error))
			this.#error = {"_": error};
		else
			// this is correct but ts can't infer it
			this.#error = error;
	}

	field(path: string): Errors | undefined {
		let error: ErrorValue = this.#error;

		for(const key of path.split(".")){
			if(error[key]){
				error = error[key];
				if(typeof error === "object")
					continue;
				break;
			}

			return;
		}

		return new Errors(error);
	}

	value(): ErrorValue | undefined {
		return this.#error["_"];
	}

	asString(): string | undefined {
		const v = this.value();
		return v && ""+v;
	}

	desc(): string {
		return this.asString() || JSON.stringify(this.#error);
	}

	asArray(): [string] | undefined {
		const v = this.value();
		return v !== undefined ? (Array.isArray(v) ? v : [""+v]) : undefined;
	}

}

type ErrorResponse = { code: number; message: string; response: any }
	| { code: 400; message: string; response: ServerError; };

export const errorsFromResponse = (error: ErrorResponse): Errors | undefined => {
	if(error.code < 400)
		return;

	switch(error.code){
		case 400:
		case 422: return new Errors(error.response);
		default: return new Errors({"_": `HTTP request failed (${error.code}): ${error.message}`});
	}
}
