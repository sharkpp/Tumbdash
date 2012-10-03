//MainWindow Component Constructor
exports.MainWindow = function() {
	return {
			'toolbar': {
					height:50,
					bottom:0,
					borderWidth:1,
					borderColor:'#999',
					backgroundColor:'white',
					zIndex:'99'
				},
			'webview': {
					backgroundColor: '#fff',
					borderRadius: 15,
					borderWidth : 5,
					borderColor : 'red'
				},
			'toolbar-prev-button': {
					left: '10%',
					height:45,
					width: 50,
					title:'prev'
				},
			'toolbar-next-button': {
					left: '20%',
					height:50,
					width: 50,
					title:'next'
				}
		};
}
