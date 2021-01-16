module.exports = {
	purge: [
		"webui/**/*.ts",
		"templates/**/*.html"
	],
	darkMode: false, // or 'media' or 'class'
	theme: {
		extend: {},
	},
	variants: {
		extend: {
			backgroundColor: ["disabled", "even"],
			display: ["group-hover", "group-focus"],
			textColor: ["disabled"],
			visibility: ["group-hover"]
		},
	},
	plugins: [],
}
