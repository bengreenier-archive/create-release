require('child_process')
  .execSync(
    'npm install @actions/core @actions/github',
    { cwd: __dirname }
  );
const fs = require('fs');
const core = require('@actions/core');
const github = require('@actions/github');

(async () => {
  try {
    const api = new github.GitHub(core.getInput('token'));

    const name = core.getInput('name');
    const code = core.getInput('code');
    const body = core.getInput('body');
    const prerelease = core.getInput('prerelease') == 'true';
    const editIfExists = core.getInput('allowUpdating') == 'true';
    const assets = core.getInput('assets').split(' ').map(asset => asset.split(':'));

    let release;

    if (editIfExists) {
      try {
        const existing = await api.repos.getReleaseByTag({
          ...github.context.repo,
          tag: code
        });

        const existingId = existing.data.id;

        console.log(`Found existing release: ${JSON.stringify(existing.data)}`);

        release = await api.repos.updateRelease({
          ...github.context.repo,
          release_id: existingId,
          tag_name: code,
          target_commitish: github.context.sha,
          name,
          body,
          prerelease: prerelease
        });
      }
      catch (error) {
        if (error.name != 'HttpError' || error.status != 404) {
          throw error;
        }
      }
    } else {
      release = await api.repos.createRelease({
        ...github.context.repo,
        tag_name: code,
        target_commitish: github.context.sha,
        name,
        body,
        prerelease: prerelease
      });
    }

    for (const [source, target, type] of assets) {
      const data = fs.readFileSync(source);
      api.repos.uploadReleaseAsset({
        url: release.data.upload_url,
        headers: {
          ['content-type']: type,
          ['content-length']: data.length
        },
        name: target,
        file: data
      });
    }
  } catch (error) {
    console.error(error);
    core.setFailed(error.message);
  }
})();
