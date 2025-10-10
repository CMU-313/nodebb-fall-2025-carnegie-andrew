{{{ if privileges.topics:reply }}}
<div component="topic/quickreply/container" class="quick-reply d-flex gap-3 mb-4">
	<div class="icon hidden-xs">
		<a class="d-inline-block position-relative" href="{{{ if loggedInUser.userslug }}}{config.relative_path}/user/{loggedInUser.userslug}{{{ else }}}#{{{ end }}}">
			{buildAvatar(loggedInUser, "48px", true, "", "user/picture")}
			{{{ if loggedInUser.status }}}<span component="user/status" class="position-absolute top-100 start-100 border border-white border-2 rounded-circle status {loggedInUser.status}"><span class="visually-hidden">[[global:{loggedInUser.status}]]</span></span>{{{ end }}}
		</a>
	</div>
	<form class="flex-grow-1 d-flex flex-column gap-2" method="post" action="{config.relative_path}/compose">
		<input type="hidden" name="tid" value="{tid}" />
		<input type="hidden" name="_csrf" value="{config.csrf_token}" />
        <input type="hidden" name="anonymous" value="0" component="topic/quickreply/anonymous" />
		<div class="quickreply-message position-relative">
			<textarea rows="4" name="content" component="topic/quickreply/text" class="form-control mousetrap" placeholder="[[modules:composer.textarea.placeholder]]"></textarea>
			<div class="imagedrop"><div>[[topic:composer.drag-and-drop-images]]</div></div>
		</div>
		<div>
			<div class="d-flex justify-content-end gap-2 align-items-center">
				<!-- Anonymous toggle (accessible) -->
				<div class="form-check d-flex align-items-center gap-2 me-auto">
					<input class="form-check-input" type="checkbox" id="qr-anon-toggle" component="topic/quickreply/anonymous/toggle" aria-label="[[topic:quickreply.anonymous-toggle-aria]]">
					<label class="form-check-label" for="qr-anon-toggle">post-anonymously</label>
				</div>
				<button type="button" component="topic/quickreply/upload/button" class="btn btn-ghost btn-sm border"><i class="fa fa-upload"></i></button>
				<button type="button" component="topic/quickreply/expand" class="btn btn-ghost btn-sm border" title="[[topic:open-composer]]"><i class="fa fa-expand"></i></button>

				<!-- Primary submit uses the toggle's state to decide anonymous posting -->
				<button type="submit" component="topic/quickreply/button" class="btn btn-sm btn-primary">[[topic:post-quick-reply]]</button>
			</div>
		</div>
	</form>
	<script>
		// Quick-reply anonymous toggle: on form submit, set the hidden anonymous input
		// based solely on the checkbox state. There is no separate anonymous submit button.
		(function () {
			// Listen for submit events (capture phase) so we can set the hidden input
			// before the form is sent.
			document.addEventListener('submit', function (ev) {
				var form = ev.target;
				if (!form || form.tagName !== 'FORM') return;
				var anonInput = form.querySelector('input[name="anonymous"][component="topic/quickreply/anonymous"]');
				var toggle = form.querySelector('#qr-anon-toggle');
				if (!anonInput) return;
				anonInput.value = (toggle && toggle.checked) ? '1' : '0';
			}, true);

			// Restore focus to textarea when an alert/error is shown by the quickreply flow.
			document.addEventListener('quickreply:error', function (ev) {
				var form = document.querySelector('[component="topic/quickreply/container"] form');
				if (!form) return;
				var textarea = form.querySelector('[component="topic/quickreply/text"]');
				if (textarea) textarea.focus();
			});
		})();
	</script>
	<form class="d-none" component="topic/quickreply/upload" method="post" enctype="multipart/form-data">
		<input type="file" name="files[]" multiple class="hidden"/>
	</form>

</div>
{{{ end }}}
