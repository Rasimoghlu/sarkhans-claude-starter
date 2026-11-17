#include <libgen.h>
#include <limits.h>
#include <mach-o/dyld.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(void) {
    char executable[PATH_MAX];
    uint32_t size = sizeof(executable);
    if (_NSGetExecutablePath(executable, &size) != 0) return 1;
    char resolved[PATH_MAX];
    if (realpath(executable, resolved) == NULL) return 1;
    char script[PATH_MAX];
    snprintf(script, sizeof(script), "%s/../Resources/launch.sh", dirname(resolved));
    execl("/bin/bash", "bash", script, (char *)NULL);
    return 127;
}
