//	var lib = require('lib');
//	var task = lib.Job.createTask({});

module.exports = (function(global){
	
	var Task = function(params){
		var self = this;

		params = params || {};

		self.title_     = undefined != params.title      ? params.title      : '';
		self.context    = undefined != params.context    ? params.context    : this;
		self.idle       = undefined != params.idle       ? params.idle       : 0;
		self.background = undefined != params.background ? params.background : false;
		self.timeout    = undefined != params.timeout    ? params.timeout    : 1000;
		self.retryCount = undefined != params.retryCount ? params.retryCount : 5;
		self.withExec   = undefined != params.withExec   ? params.withExec   : true;
		self.timeoutFunc= undefined != params.timeoutFunc? params.timeoutFunc: function(){
				self.exit(false);
			};
		// 許可されたタスク状態を設定
		self.stateList = {};
		var stateList = params.stateList || {};
		for (i in stateList) {
			var state = stateList[i];
			var stateItem = {};
			if ('string' == typeof(state)) {
				stateItem.text      = state;
				stateItem.duplicate = true;
			}
			else {
				stateItem.text      = undefined != state.text ? state.text : 'state('+i+')';
				stateItem.duplicate = undefined != state.duplicate ? state.duplicate : true;
			}
			self.stateList[i] = stateItem;
		}

		self.state_ = self.idle;

		self.taskList = [];
	};

	var lib = require('lib');

	/////////////////////////////////////////
	// プロパティ
	/////////////////////////////////////////

	Task.prototype.__defineGetter__("state", function(){
		return this.getState();
	});

	Task.prototype.__defineGetter__("title", function(){
		return this.getTitle();
	});

	/////////////////////////////////////////
	// メソッド
	/////////////////////////////////////////

	// 現在の状態を取得
	Task.prototype.getTitle = function() {
		return this.title_;
	}

	// 現在の状態を取得
	Task.prototype.getState = function() {
		return this.state_;
	}

	// タスクの個数を取得
	Task.prototype.getTaskCount = function() {
		return this.taskList.length;
	}

	// 現在の状態を取得
	Task.prototype.getStateText = function(state) {
		return undefined == state ? this.stateList[this.state_].text
		                          : this.stateList[state].text;
	}

	// 待機中か？
	Task.prototype.isIdle = function() {
		return this.idle == this.state_;
	}

	// タスクの追加
	Task.prototype.add = function(task, params) {
		var self = this;
lib.Log.debug(self.title_ + ':add ' + task.toString().split("{")[0]);
		var availableStateList = self.stateList && self.stateList.length;
		var newTask = task.call(self.context, params);
		newTask.retry = undefined == task.retryCount ? self.retryCount : task.retryCount;
		// あらかじめリストが指定されていたら、リストに含まれない場合は拒否する
		if (availableStateList &&
			undefined == self.stateList[newTask.state]) {
lib.Log.debug(self.title_+': '+JSON.stringify(self.stateList));
			throw "unknwon task state " + newTask.state;
			return;
		}
		// タスクの重複を許すか確認しだめなら追加しない？
		if (availableStateList &&
			!self.stateList[newTask.state].duplicate &&
			0 < self.taskList.length &&
			newTask.state == self.taskList[self.taskList.length - 1].state) {
lib.Log.debug(self.title_+': duplicated not add! '+self.stateList[newTask.state].text);
			return;
		}
		self.taskList.push(newTask);
		if (self.withExec) {
			if (!self.taskList.length || !self.taskList[0].running) {
lib.Log.debug(self.title_ + ':add task.len=' + self.taskList.length + ', running=' + self.taskList[0].running);
				self.exec();
			}
			else {
				// 処理が実行中だったので終了のタイミングなどで実行する
//				self.task.
			}
		}
	}

	// バックグランドタスク実行時のコールバックを生成
	Task.prototype.createCallback = function(callback) {
		var self = this;
		return function(){
				// タスクが空っぽなのに呼ばれた
				if (!self.taskList.length) {Ti.API.debug('createCallback #1');
					return;
				}

				// バックグラウンドでの実行ではない
				var task = self.taskList[0];
				if (!task.background) {Ti.API.debug('createCallback #2');
					return;
				}

				// タイムアウトが指定されてる？
				if (task.timeoutId) {Ti.API.debug('createCallback #3');
					// タイムアウトをクリア＆すでにタイムアウト処理中な場合は正常処理をキャンセル
					clearTimeout(task.timeoutId);
					task.timeoutId = 0;
					if (task.timeoutAccepted) {
						return;
					}
				}
lib.Log.debug(self.title_ + ':createCallback #4');
				callback.apply(self.context, arguments);
			};
	}

	// タスクの終了
	Task.prototype.exit = function(success) {
		var self = this;
		success = undefined == success ? true : success;
		var state = self.state_;
		self.state_ = self.idle;
lib.Log.debug(self.title_+': Task.exit '+(success?'true':'false'));
		var task = self.taskList[0];
		// タイムアウトが指定されてる？
		if (task.timeoutId) {
			// タイムアウトをクリア＆すでにタイムアウト処理中な場合は正常処理をキャンセル
			clearTimeout(task.timeoutId);
			task.timeoutId = 0;
			if (task.timeoutAccepted) {
				success = false;
			}
		}
		//
		if (!success && task.retry) {
			self.fireEvent('retry', { state: state });
			task.retry--;
lib.Log.debug(self.title_ + ': retry rest '+task.retry);
			task.timeoutAccepted = false;
		}
		else {
			self.fireEvent('after', { state: state });
			self.taskList.shift();
		}
		if (self.taskList.length) {
			self.exec();
		}
		else {
			self.fireEvent('complite', {});
		}
	}
	
	// タスクの実行
	Task.prototype.exec = function() {
		var self = this;
		if (!self.taskList.length) {
			return false;
		}
		// タスク実行時間をチェック
		if (self.topTaskTime) {
			var now = (new Date()).getTime();
			var busyTime = now - self.topTaskTime;
			if (100 < busyTime) { // 遅延実行
				self.topTaskTime = 0;
				setTimeout(function(){ self.exec.call(self.context); }, 10);
				return true;
			}
		}
		else {
			self.topTaskTime = (new Date()).getTime();
		}
		//
		var result     = true;
		var task       = self.taskList[0];
		var timeout    = undefined == task.timeout    ? self.timeout    : task.timeout;
		task.background= undefined == task.background ? self.background : task.background;
//		task.retry     = undefined == task.retryCount ? self.retryCount : task.retryCount;
		// 現在状態を記録
		self.state_ = task.state;
lib.Log.debug(self.title_ + ':exec ' + task.exec.toString().split("{")[0] + ' : bg=' + task.background);
		// タスクを実行
		if (!task.background) {
			self.fireEvent('before', { state: self.state_ });
			task.running = true;
			result = task.exec.call(self.context);
		}
		else {
			self.fireEvent('before', { state: self.state_ });
			self.topTaskTime = 0;
			task.running = true;
			setTimeout(function(){ task.exec.call(self.context); }, 1);
			// タイムアウト処理
			if (0 < timeout) {
timeout*=10;
				var timeoutExec = task.timeoutExec || self.timeoutFunc;
				task.timeoutId = setTimeout(function(){
lib.Log.debug(self.title_ + ':timeout');
						task.timeoutAccepted = true;
						task.timeoutId = 0;
						timeoutExec.call(self.context);
					}, timeout);
			}
		}
		return result;
	}

	// イベントリスナーの登録
	Task.prototype.addEventListener = function(eventName, callback) {
		this.listeners = this.listeners || {};
		this.listeners[eventName] = this.listeners[eventName] || [];
		this.listeners[eventName].push(callback);
	};

	// イベントの発火
	Task.prototype.fireEvent = function(eventName, data) {
		data = data || {};
		data.source = this;
		data.type   = eventName;
		this.listeners = this.listeners || {};
		var eventListeners = this.listeners[eventName] || [];
		for (var i = 0; i < eventListeners.length; i++) {
			eventListeners[i].call(this, data);
		}
	};

	// インスタンスを生成して返す	
	return Task;
})(this);
