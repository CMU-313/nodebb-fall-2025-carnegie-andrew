<div class="container" data-page="voice" data-module="forum/voice">
  <div class="row">
    <div class="col-12 col-lg-10 mx-auto">

      <div class="d-flex align-items-center justify-content-between mb-3">
        <h1 class="h3 m-0">{title}</h1>
        {{{ if isElevated }}}
        <span class="badge rounded-1 bg-secondary text-uppercase">{role}</span>
        {{{ else }}}
        <span class="badge rounded-1 bg-light text-dark text-uppercase">{role}</span>
        {{{ end }}}
      </div>

      {{{ if user.loggedIn }}}

      <!-- Status / counters -->
      <div class="card mb-3">
        <div class="card-body d-flex flex-wrap gap-3 align-items-center">
          <div>
            <div class="fw-semibold">Queue</div>
            <div>
              <span id="voice-queue-count" class="badge rounded-1 bg-primary">{queueCount}</span>
              <span class="text-muted small ms-1">
                {{{ if queueCount === 1 }}}student ahead{{{ else }}}students ahead{{{ end }}}
              </span>
            </div>
          </div>

          <div>
            <div class="fw-semibold">Your status</div>
            <div id="voice-presence" class="text-muted">
              {presence} <!-- none | in_queue | in_call -->
            </div>
          </div>

          <div class="ms-auto">
            <span class="fw-semibold me-2">OH:</span>
            <span id="voice-oh-status" class="badge rounded-1 {{{ if ohStatus === 'active' }}}bg-success{{{ else }}}bg-secondary{{{ end }}}">
              {ohStatus}
            </span>
          </div>
        </div>
      </div>

      <!-- Ask-a-question form -->
      <form id="voice-question-form" class="card mb-3">
        <div class="card-body">
          <label for="voice-question" class="form-label fw-semibold">Your question</label>
          <input
            id="voice-question"
            name="question"
            type="text"
            class="form-control"
            placeholder="Please enter your question"
            value="{question}"
            autocomplete="off"
          />
          <div class="mt-3 d-flex gap-2">
            <button type="submit" class="btn btn-primary" id="voice-submit-question">
              submit
            </button>
            <button type="button" class="btn btn-outline-secondary" id="voice-clear-question">
              clear
            </button>
          </div>
        </div>
      </form>

      <!-- Actions -->
      <div class="card mb-4">
        <div class="card-body d-flex flex-wrap gap-2">
          <button class="btn btn-primary" id="voice-join">
            <i class="fa fa-sign-in"></i> Join queue
          </button>
          <button class="btn btn-outline-secondary" id="voice-leave">
            <i class="fa fa-sign-out"></i> Leave
          </button>
          <button class="btn btn-outline-danger" id="voice-exit-call">
            <i class="fa fa-phone"></i> Exit call
          </button>

          {{{ if isElevated }}}
          <div class="vr mx-2 d-none d-lg-block"></div>
          <button class="btn btn-success" id="voice-admit">
            <i class="fa fa-check"></i> Admit next
          </button>
          <button class="btn btn-outline-warning" id="voice-toggle-oh">
            <i class="fa fa-power-off"></i> Toggle OH
          </button>
          {{{ end }}}
        </div>
      </div>

      <!-- Optional: live queue list (shown if you pass queue=[] from controller) -->
      {{{ if queue.length }}}
      <div class="card mb-4">
        <div class="card-header fw-semibold">Queue</div>
        <ul class="list-group list-group-flush" id="voice-queue-list">
          {{{ each queue }}}
          <li class="list-group-item d-flex align-items-center justify-content-between">
            <span class="text-truncate">
              {./position}. {./displayname} <span class="text-muted">@{./username}</span>
            </span>
            {{{ if @root.isElevated }}}
            <button class="btn btn-sm btn-outline-danger" data-action="remove" data-uid="{./uid}">
              <i class="fa fa-times"></i>
            </button>
            {{{ end }}}
          </li>
          {{{ end }}}
        </ul>
      </div>
      {{{ end }}}

      {{{ else }}}
      <!-- Logged-out -->
      <div class="alert alert-warning" role="alert">
        Please log in to access voice channels.
      </div>
      {{{ end }}}

    </div>
  </div>
</div>
