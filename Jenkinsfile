pipeline {

    agent any

    options {
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
    }

    environment {
        DOCKER_IMAGE = 'simple-task-api'

        SONAR_HOST_URL = 'http://localhost:9000'
        SONAR_CREDENTIAL_ID = 'sonar-token-local'

        STAGING_CONTAINER = 'simple-task-api-staging'
        PRODUCTION_CONTAINER = 'simple-task-api-production'

        STAGING_URL = 'http://localhost:5001/health'
        PRODUCTION_URL = 'http://localhost:5000/health'
        METRICS_URL = 'http://localhost:5000/metrics'
        PROMETHEUS_URL = 'http://localhost:9090/-/healthy'

        PREVIOUS_PRODUCTION_IMAGE = ''
    }

    stages {

        // ============================================================
        // 1. BUILD
        // ============================================================

        stage('1. Build') {
            steps {

                echo '========================================'
                echo 'STAGE 1 - BUILD'
                echo '========================================'

                bat 'npm install'

                script {
                    env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_COMMIT.take(7)}"
                    env.FULL_IMAGE = "${env.DOCKER_IMAGE}:${env.IMAGE_TAG}"
                }

                echo "Building Docker image: ${env.FULL_IMAGE}"

                bat """
                    docker build ^
                    -t ${FULL_IMAGE} ^
                    -t ${DOCKER_IMAGE}:latest .
                """

                bat """
                    docker image inspect ${FULL_IMAGE} >nul
                    if errorlevel 1 (
                        echo Docker image verification failed.
                        exit /b 1
                    )
                """

                echo "Docker image created successfully: ${env.FULL_IMAGE}"
            }
        }


        // ============================================================
        // 2. AUTOMATED TEST
        // ============================================================

        stage('2. Automated Test') {
            steps {

                echo '========================================'
                echo 'STAGE 2 - AUTOMATED TEST'
                echo '========================================'

                bat '''
                    if exist junit.xml del /f /q junit.xml

                    set "JEST_JUNIT_OUTPUT_FILE=%CD%\\junit.xml"

                    npm run test:ci

                    if not exist junit.xml (
                        echo ERROR: junit.xml was not generated.
                        exit /b 1
                    )
                '''
            }

            post {
                always {
                    junit(
                        testResults: 'junit.xml',
                        allowEmptyResults: false
                    )
                }
            }
        }


        // ============================================================
        // 3. CODE QUALITY
        // ============================================================

        stage('3. Code Quality') {
            steps {

                echo '========================================'
                echo 'STAGE 3 - CODE QUALITY'
                echo '========================================'

                withCredentials([
                    string(
                        credentialsId: "${SONAR_CREDENTIAL_ID}",
                        variable: 'SONAR_TOKEN'
                    )
                ]) {

                    bat """
                        npx sonarqube-scanner ^
                        -Dsonar.host.url=${SONAR_HOST_URL} ^
                        -Dsonar.login=%SONAR_TOKEN% ^
                        -Dsonar.qualitygate.wait=true
                    """
                }

                echo 'SonarQube analysis and quality gate completed.'
            }
        }


        // ============================================================
        // 4. SECURITY SCAN
        // ============================================================

        stage('4. Security Scan') {
            steps {

                echo '========================================'
                echo 'STAGE 4 - SECURITY'
                echo '========================================'

                echo 'Checking npm dependencies...'

                bat 'npm audit --audit-level=high'

                echo 'Running Trivy HIGH and CRITICAL scan...'

                bat """
                    docker run --rm ^
                    -v //var/run/docker.sock:/var/run/docker.sock ^
                    aquasec/trivy:latest ^
                    image ^
                    --severity HIGH,CRITICAL ^
                    --format table ^
                    ${FULL_IMAGE}
                """

                echo 'Blocking scan: CRITICAL vulnerabilities only...'

                bat """
                    docker run --rm ^
                    -v //var/run/docker.sock:/var/run/docker.sock ^
                    aquasec/trivy:latest ^
                    image ^
                    --severity CRITICAL ^
                    --ignore-unfixed ^
                    --exit-code 1 ^
                    ${FULL_IMAGE}
                """

                echo 'Security scan completed.'
            }
        }


        // ============================================================
        // 5. DEPLOY TO STAGING
        // ============================================================

        stage('5. Deploy to Staging') {
            steps {

                echo '========================================'
                echo 'STAGE 5 - STAGING DEPLOYMENT'
                echo '========================================'

                echo "Deploying image: ${env.FULL_IMAGE}"

                /*
                 * Remove previous staging container if it exists.
                 */
                bat """
                    docker rm -f ${STAGING_CONTAINER} >nul 2>&1
                    exit /b 0
                """

                /*
                 * Validate Docker Compose with IMAGE supplied.
                 */
                bat """
                    set "IMAGE=${FULL_IMAGE}" && ^
                    docker-compose config
                """

                /*
                 * Deploy staging.
                 */
                bat """
                    set "IMAGE=${FULL_IMAGE}" && ^
                    docker-compose up -d staging
                """

                echo 'Waiting for staging application...'

                script {
                    waitForHttp(
                        env.STAGING_URL,
                        20,
                        3
                    )
                }

                echo 'Staging deployment and health check passed.'
            }
        }


        // ============================================================
        // 6. RELEASE TO PRODUCTION
        // ============================================================

        stage('6. Release to Production') {
            steps {

                echo '========================================'
                echo 'STAGE 6 - PRODUCTION RELEASE'
                echo '========================================'

                echo "Preparing production release: ${env.FULL_IMAGE}"

                /*
                 * Save the currently running production image.
                 * This allows a real rollback if the new release fails.
                 */
                script {

                    def containerExists = bat(
                        returnStatus: true,
                        script: """
                            docker inspect ${env.PRODUCTION_CONTAINER} >nul 2>&1
                        """
                    )

                    if (containerExists == 0) {

                        env.PREVIOUS_PRODUCTION_IMAGE = bat(
                            returnStdout: true,
                            script: """
                                docker inspect --format="{{.Config.Image}}" ${env.PRODUCTION_CONTAINER}
                            """
                        ).trim()

                        echo "Previous production image: ${env.PREVIOUS_PRODUCTION_IMAGE}"

                    } else {

                        env.PREVIOUS_PRODUCTION_IMAGE = ''

                        echo 'No previous production container found.'
                    }
                }

                /*
                 * Validate Compose before modifying production.
                 */
                bat """
                    set "IMAGE=${FULL_IMAGE}" && ^
                    docker-compose config
                """

                /*
                 * Remove old production container.
                 */
                bat """
                    docker rm -f ${PRODUCTION_CONTAINER} >nul 2>&1
                    exit /b 0
                """

                /*
                 * Deploy new production version.
                 */
                bat """
                    set "IMAGE=${FULL_IMAGE}" && ^
                    docker-compose up -d production
                """

                echo 'Waiting for production health check...'

                script {
                    waitForHttp(
                        env.PRODUCTION_URL,
                        20,
                        3
                    )
                }

                echo 'Production release completed successfully.'
            }

            post {

                failure {

                    echo '========================================'
                    echo 'PRODUCTION DEPLOYMENT FAILED'
                    echo 'ATTEMPTING ROLLBACK'
                    echo '========================================'

                    script {

                        if (env.PREVIOUS_PRODUCTION_IMAGE?.trim()) {

                            echo "Rolling back to: ${env.PREVIOUS_PRODUCTION_IMAGE}"

                            bat """
                                docker rm -f ${PRODUCTION_CONTAINER} >nul 2>&1
                                exit /b 0
                            """

                            bat """
                                set "IMAGE=${PREVIOUS_PRODUCTION_IMAGE}" && ^
                                docker-compose up -d production
                            """

                            echo 'Rollback command completed.'

                        } else {

                            echo 'No previous production image was available.'
                            echo 'Automatic rollback could not be performed.'
                        }
                    }
                }
            }
        }


        // ============================================================
        // 7. MONITORING & ALERTING
        // ============================================================

        stage('7. Monitoring & Alerting') {
            steps {

                echo '========================================'
                echo 'STAGE 7 - MONITORING & ALERTING'
                echo '========================================'

                /*
                 * Validate Compose configuration.
                 */
                bat """
                    set "IMAGE=${FULL_IMAGE}" && ^
                    docker-compose config
                """

                /*
                 * Start Prometheus.
                 */
                bat """
                    set "IMAGE=${FULL_IMAGE}" && ^
                    docker-compose up -d prometheus
                """

                echo 'Checking Prometheus...'

                script {
                    waitForHttp(
                        env.PROMETHEUS_URL,
                        20,
                        3
                    )
                }

                echo 'Checking application metrics endpoint...'

                script {
                    waitForHttp(
                        env.METRICS_URL,
                        20,
                        3
                    )
                }

                /*
                 * Verify that the TaskApiDown alert rule
                 * is actually loaded into Prometheus.
                 */
                bat '''
                    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
                    "$r=Invoke-RestMethod -Uri 'http://localhost:9090/api/v1/rules' -UseBasicParsing; ^
                    if($r.status -ne 'success'){ ^
                        Write-Error 'Prometheus rules API failed'; ^
                        exit 1 ^
                    }; ^
                    $rule=$r.data.groups.rules | Where-Object {$_.name -eq 'TaskApiDown'}; ^
                    if(-not $rule){ ^
                        Write-Error 'TaskApiDown alert rule was not found'; ^
                        exit 1 ^
                    }; ^
                    Write-Host 'TaskApiDown alert rule is loaded successfully.'"
                '''

                echo 'Prometheus monitoring and alert-rule verification completed.'
            }
        }
    }


    // ================================================================
    // PIPELINE POST ACTIONS
    // ================================================================

    post {

        success {

            echo '========================================'
            echo 'PIPELINE SUCCESS'
            echo '========================================'

            echo 'All seven DevOps stages completed successfully.'

            echo "Released image: ${env.FULL_IMAGE}"
        }

        failure {

            echo '========================================'
            echo 'PIPELINE FAILED'
            echo '========================================'

            echo 'Check the failed stage and Jenkins console output.'
        }

        always {

            echo '========================================'
            echo 'PIPELINE FINISHED'
            echo '========================================'
        }
    }
}


// ====================================================================
// HTTP HEALTH CHECK HELPER
// ====================================================================

def waitForHttp(String url, int attempts = 20, int delaySeconds = 3) {

    def command = """
        powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "\\$url='${url}'; ^
        for(\\$i=1; \\$i -le ${attempts}; \\$i++){ ^
            try { ^
                \\$response=Invoke-WebRequest -Uri \\$url -UseBasicParsing -TimeoutSec 5; ^
                if(\\$response.StatusCode -eq 200){ ^
                    Write-Host 'Health check passed:' \\$url; ^
                    exit 0 ^
                } ^
            } catch { ^
                Write-Host 'Attempt' \\$i 'failed. Retrying...' ^
            }; ^
            Start-Sleep -Seconds ${delaySeconds} ^
        }; ^
        Write-Error 'Health check failed:' \\$url; ^
        exit 1"
    """

    def result = bat(
        returnStatus: true,
        script: command
    )

    if (result != 0) {
        error("Health check failed for ${url}")
    }
}