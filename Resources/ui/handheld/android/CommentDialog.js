//PinDialog Component Constructor
module.exports = (function() {
	return {
			'view': {
					width: '280dp',
					height: '200dp',
					borderRadius: 10,
					borderWidth: 3,
				},
			'view-title': {
					width: '100%',
					height: '32dp',
					top: '0dp',
				},
			'text': {
					left: '20dp',
					right: '20dp',
					top: '52dp',
					bottom: '60dp',
				},
			'ok-button': {
					width: '50%',
					left: '0%',
					bottom: '0dp',
				},
			'cancel-button': {
					width: '50%',
					left: '50%',
					bottom: '0dp',
				},
		};
})();
