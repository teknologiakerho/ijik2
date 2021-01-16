import typescript from "rollup-plugin-typescript2";
import commonjs from "rollup-plugin-commonjs";
import resolve from "rollup-plugin-node-resolve";
import {terser} from "rollup-plugin-terser";

export default {
	input: "webui/boot.ts",
	output: {
		file: "static/editor.js",
		format: "iife",
		name: "ijik"
	},
	plugins: [
		typescript(),
		commonjs({sourceMap: false}),
		resolve(),
		process.env.NODE_ENV === "production" && terser({
			format: { comments: false }
		})
	]
};
