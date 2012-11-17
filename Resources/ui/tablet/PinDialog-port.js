//PinDialog Component Constructor
module.exports = (function() {
	return {
			'view': {
					left: '20dp',
					top: '20dp',
					right: '20dp',
					bottom: '20dp',
					borderRadius: 15,
				},
			'tags-list': {
					left: '10dp',
					top: '10dp',
					bottom: '100dp',
					right: '10dp',
				},
			'button-area': {
					left: '10dp',
					right: '10dp',
					bottom: '10dp',
					height:'80dp',
				},
			'like-check': {
					left:  '0%',
					top:   '0%',
					height:'50%',
					width: '50%',
				},
			'comment-button': {
					left:  '50%',
					top:   '0%',
					height:'50%',
					width: '50%',
				},
			'ok-button': {
					left:  '0%',
					top:   '50%',
					height:'50%',
					width: '50%',
				},
			'cancel-button': {
					left:  '50%',
					top:   '50%',
					height:'50%',
					width: '50%',
				},
		};
})();
