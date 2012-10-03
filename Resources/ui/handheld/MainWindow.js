//MainWindow Component Constructor
exports.MainWindow = function() {
	return {
			'webview': {
					backgroundColor: '#fff',
					top: '0%',
					bottom: '15%',
				//	borderRadius: 15,
				//	borderWidth : 5,
				//	borderColor : 'red'
				},
			'toolbar': {
					height: '15%',
					bottom: 0,
					backgroundColor:'#356',
				},
			'toolbar-like-button': {
					left:  '1%',
					top:   '5%',
					height:'90%',
					width: '18%',
					title:'like'
				},
			'toolbar-reblog-button': {
					left:  '21%',
					top:   '5%',
					height:'90%',
					width: '18%',
					title:'reblog'
				},
			'toolbar-prev-button': {
					left:  '41%',
					top:   '5%',
					height:'90%',
					width: '18%',
					title:'prev'
				},
			'toolbar-next-button': {
					left:  '61%',
					top:   '5%',
					height:'90%',
					width: '18%',
					title:'next'
				},
			'toolbar-pin-button': {
					left:  '81%',
					top:   '5%',
					height:'90%',
					width: '18%',
					title:'pin'
				},
			'toolbar-pin-badge': {
					left:  '90%',
					top:   '1%',
					height:'15%',
					width: '9%',
					borderRadius: 15,
					backgroundColor: '#f00',
					color: '#fff',
					textAlign: 'center'
				}
		};
}
