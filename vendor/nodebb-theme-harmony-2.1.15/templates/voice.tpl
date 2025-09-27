<div class="container my-5">
  <div class="row justify-content-center">
    <div class="col-12 col-md-8 col-lg-6 text-center">

      <h2 class="mb-3">Voice Channel - {role}</h2>

      <p class="mb-5 fs-5">{queueCount} students ahead of you</p>

      <form method="post" action="{config.relative_path}/voice/submit">

        <div class="mb-4">
          <label for="voice-question" class="visually-hidden">Your question</label>
          <textarea id="voice-question"
                    name="question"
                    class="form-control form-control-lg text-center py-4"
                    rows="3"
                    placeholder="Please enter your question"></textarea>
        </div>

        <div>
          <button type="submit" class="btn btn-secondary btn-lg px-5">
            submit
          </button>
        </div>

      </form>

    </div>
  </div>
</div>