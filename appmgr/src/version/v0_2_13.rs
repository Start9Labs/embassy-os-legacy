use super::*;

const V0_2_13: emver::Version = emver::Version::new(0, 2, 13, 0);

pub struct Version;
#[async_trait]
impl VersionT for Version {
    type Previous = v0_2_12::Version;
    fn new() -> Self {
        Version
    }
    fn semver(&self) -> &'static emver::Version {
        &V0_2_13
    }
    async fn up(&self) -> Result<(), Error> {
        Ok(())
    }
    async fn down(&self) -> Result<(), Error> {
        Ok(())
    }
}
